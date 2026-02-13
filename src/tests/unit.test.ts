#!/usr/bin/env bun

/**
 * Unit tests for varg SDK (no API calls required)
 * Run with: bun run src/tests/unit.test.ts
 */

import { z } from "zod";
import { registry } from "../core/registry";
import { findSimilar, resolve, suggest } from "../core/registry/resolver";
import { getCliSchemaInfo } from "../core/schema/helpers";
import {
  applyDefaults,
  validateAndPrepare,
  validateInputs,
} from "../core/schema/validator";
import { allDefinitions } from "../definitions";
import { allActions } from "../definitions/actions";
import { allModels } from "../definitions/models";
import { allSkills } from "../definitions/skills";
import { providers } from "../providers";

// Colors for output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`${green("✓")} ${name}`);
  } catch (error) {
    failed++;
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`${red("✗")} ${name}`);
    console.log(`  ${red(msg)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Register all definitions first
for (const definition of allDefinitions) {
  registry.register(definition);
}

console.log(`\n${cyan("═".repeat(60))}`);
console.log(cyan(" VARG SDK UNIT TESTS"));
console.log(`${cyan("═".repeat(60))}\n`);

// ============================================================================
// Definition Count Tests
// ============================================================================

console.log(dim("─ Definition Counts ─\n"));

test("all models are exported", () => {
  assert(
    allModels.length >= 8,
    `Expected at least 8 models, got ${allModels.length}`,
  );
});

test("all actions are exported", () => {
  assert(
    allActions.length >= 14,
    `Expected at least 14 actions, got ${allActions.length}`,
  );
});

test("all skills are exported", () => {
  assert(
    allSkills.length >= 2,
    `Expected at least 2 skills, got ${allSkills.length}`,
  );
});

test("allDefinitions contains all definitions", () => {
  const expected = allModels.length + allActions.length + allSkills.length;
  assertEqual(
    allDefinitions.length,
    expected,
    `Expected ${expected} total definitions`,
  );
});

// ============================================================================
// Registry Tests
// ============================================================================

console.log(`\n${dim("─ Registry ─\n")}`);

test("registry.list() returns all definitions", () => {
  const all = registry.list();
  assert(all.length > 0, "Registry is empty");
});

test("registry.list('model') filters correctly", () => {
  const models = registry.list("model");
  assert(
    models.every((d) => d.type === "model"),
    "Non-model in model list",
  );
});

test("registry.list('action') filters correctly", () => {
  const actions = registry.list("action");
  assert(
    actions.every((d) => d.type === "action"),
    "Non-action in action list",
  );
});

test("registry.list('skill') filters correctly", () => {
  const skills = registry.list("skill");
  assert(
    skills.every((d) => d.type === "skill"),
    "Non-skill in skill list",
  );
});

test("registry.resolve() finds models", () => {
  const kling = registry.resolve("kling");
  assert(kling !== null, "Could not resolve kling");
  assertEqual(kling?.type, "model");
});

test("registry.resolve() finds actions", () => {
  const video = registry.resolve("video");
  assert(video !== null, "Could not resolve video");
  assertEqual(video?.type, "action");
});

test("registry.resolve() finds skills", () => {
  const skill = registry.resolve("talking-character");
  assert(skill !== null, "Could not resolve talking-character");
  assertEqual(skill?.type, "skill");
});

test("registry.resolve() returns null for unknown", () => {
  const unknown = registry.resolve("nonexistent-thing");
  assert(unknown === null, "Should return null for unknown");
});

test("registry.has() works correctly", () => {
  assert(registry.has("video"), "Should have video");
  assert(!registry.has("nonexistent"), "Should not have nonexistent");
});

test("registry.search() finds matching definitions", () => {
  const results = registry.search("video");
  assert(results.length > 0, "Should find video-related definitions");
});

test("registry.getModel() returns only models", () => {
  const kling = registry.getModel("kling");
  assert(kling !== undefined, "Should find kling model");
  assert(
    registry.getModel("video") === undefined,
    "Should not find video as model",
  );
});

test("registry.getAction() returns only actions", () => {
  const video = registry.getAction("video");
  assert(video !== undefined, "Should find video action");
  assert(
    registry.getAction("kling") === undefined,
    "Should not find kling as action",
  );
});

test("registry.stats returns correct counts", () => {
  const stats = registry.stats;
  assert(stats.models > 0, "Should have models");
  assert(stats.actions > 0, "Should have actions");
  assert(stats.skills > 0, "Should have skills");
});

// ============================================================================
// Resolver Tests
// ============================================================================

console.log(`\n${dim("─ Resolver ─\n")}`);

test("resolve() returns exact matches", () => {
  const result = resolve("video");
  assertEqual(result.matchType, "exact");
  assert(result.definition !== null, "Should find definition");
});

test("resolve() handles fuzzy matching", () => {
  const result = resolve("vid", { fuzzy: true });
  assert(result.suggestions !== undefined, "Should have suggestions");
});

test("resolve() throws on required not found", () => {
  let threw = false;
  try {
    resolve("nonexistent", { required: true });
  } catch {
    threw = true;
  }
  assert(threw, "Should throw for required not found");
});

test("findSimilar() returns suggestions", () => {
  const similar = findSimilar("vide");
  assert(similar.length > 0, "Should find similar names");
  assert(similar.includes("video"), "Should suggest 'video'");
});

test("suggest() returns prefix matches", () => {
  const suggestions = suggest("vi");
  assert(
    suggestions.some((s) => s.startsWith("vi")),
    "Should return prefix matches",
  );
});

// ============================================================================
// Schema Validation Tests (Zod-based)
// ============================================================================

console.log(`\n${dim("─ Schema Validation (Zod) ─\n")}`);

// Create a test Zod schema
const testSchema = z.object({
  prompt: z.string().describe("Test prompt"),
  count: z.number().int().default(1).describe("Count"),
  mode: z.enum(["fast", "slow"]).default("fast").describe("Mode"),
});

test("validateInputs accepts valid inputs", () => {
  const result = validateInputs({ prompt: "test" }, testSchema);
  assert(
    result.valid,
    `Should be valid: ${result.errors.map((e) => e.message).join(", ")}`,
  );
});

test("validateInputs rejects missing required", () => {
  const result = validateInputs({}, testSchema);
  assert(!result.valid, "Should be invalid");
  assert(
    result.errors.some((e) => e.path === "prompt"),
    "Should report missing prompt",
  );
});

test("validateInputs validates enum values", () => {
  const result = validateInputs(
    { prompt: "test", mode: "invalid" },
    testSchema,
  );
  assert(!result.valid, "Should reject invalid enum");
});

test("applyDefaults adds default values", () => {
  const inputs = applyDefaults({ prompt: "test" }, testSchema);
  assertEqual(inputs.count, 1, "Should apply count default");
  assertEqual(inputs.mode, "fast", "Should apply mode default");
});

test("validateAndPrepare combines validation and defaults", () => {
  const result = validateAndPrepare({ prompt: "test" }, testSchema);
  assert(result.valid, "Should be valid");
  assertEqual(result.data?.count, 1, "Should have default count");
});

// ============================================================================
// Model Definition Tests
// ============================================================================

console.log(`\n${dim("─ Model Definitions ─\n")}`);

for (const model of allModels) {
  test(`model '${model.name}' has required fields`, () => {
    assert(model.type === "model", "Type should be 'model'");
    assert(model.name.length > 0, "Name should not be empty");
    assert(model.description.length > 0, "Description should not be empty");
    assert(model.providers.length > 0, "Should have providers");
    assert(model.defaultProvider.length > 0, "Should have default provider");
    assert(
      model.providers.includes(model.defaultProvider),
      "Default provider should be in providers",
    );
    assert(model.schema !== undefined, "Should have schema");
    // Use getCliSchemaInfo to check properties
    const { properties } = getCliSchemaInfo(model.schema.input);
    assert(Object.keys(properties).length > 0, "Should have input properties");
  });
}

// ============================================================================
// Action Definition Tests
// ============================================================================

console.log(`\n${dim("─ Action Definitions ─\n")}`);

for (const action of allActions) {
  test(`action '${action.name}' has required fields`, () => {
    assert(action.type === "action", "Type should be 'action'");
    assert(action.name.length > 0, "Name should not be empty");
    assert(action.description.length > 0, "Description should not be empty");
    assert(action.schema !== undefined, "Should have schema");
    assert(
      action.routes !== undefined || action.execute !== undefined,
      "Should have routes or execute function",
    );
  });
}

// ============================================================================
// Skill Definition Tests
// ============================================================================

console.log(`\n${dim("─ Skill Definitions ─\n")}`);

for (const skill of allSkills) {
  test(`skill '${skill.name}' has required fields`, () => {
    assert(skill.type === "skill", "Type should be 'skill'");
    assert(skill.name.length > 0, "Name should not be empty");
    assert(skill.description.length > 0, "Description should not be empty");
    assert(skill.schema !== undefined, "Should have schema");
    assert(skill.steps.length > 0, "Should have steps");
  });

  test(`skill '${skill.name}' steps reference valid targets`, () => {
    for (const step of skill.steps) {
      assert(step.name.length > 0, `Step should have name`);
      assert(step.run.length > 0, `Step '${step.name}' should have run target`);
      // Note: We don't validate if target exists as it might be another action/model
    }
  });
}

// ============================================================================
// Provider Registration Tests
// ============================================================================

console.log(`\n${dim("─ Provider Registration ─\n")}`);

const expectedProviders = ["groq", "fireworks", "ffmpeg", "storage"];

for (const name of expectedProviders) {
  test(`provider '${name}' is registered`, () => {
    const provider = providers.get(name);
    assert(provider !== undefined, `Provider '${name}' not found`);
    assertEqual(provider?.name, name, "Provider name should match");
  });
}

test(`providers.all() returns all providers`, () => {
  const list = providers.all();
  assert(
    list.length >= expectedProviders.length,
    `Expected at least ${expectedProviders.length} providers`,
  );
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${cyan("═".repeat(60))}`);
console.log(cyan(" SUMMARY"));
console.log(`${cyan("═".repeat(60))}\n`);

const total = passed + failed;
console.log(`Total:  ${total}`);
console.log(`Passed: ${green(String(passed))}`);
console.log(`Failed: ${failed > 0 ? red(String(failed)) : "0"}`);
console.log("");

if (failed > 0) {
  console.log(red(`${failed} test(s) failed!`));
  process.exit(1);
} else {
  console.log(green("All tests passed! ✨"));
}
