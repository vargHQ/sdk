#!/usr/bin/env bun

/**
 * Comprehensive tests for all varg SDK actions and models
 * Run with: bun run src/tests/all.test.ts
 *
 * Note: Most tests require API keys to be set in environment variables:
 * - FAL_KEY
 * - REPLICATE_API_TOKEN
 * - ELEVENLABS_API_KEY
 * - GROQ_API_KEY
 * - FIREWORKS_API_KEY
 * - HIGGSFIELD_API_KEY / HF_API_KEY
 * - CLOUDFLARE_R2_API_URL, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_ACCESS_SECRET
 */

import { executor } from "../core/executor";
import { registry } from "../core/registry";
import { getCliSchemaInfo } from "../core/schema/helpers";
import { applyDefaults, validateInputs } from "../core/schema/validator";
import { allDefinitions } from "../definitions";
import { providers } from "../providers";

// Register all definitions
for (const definition of allDefinitions) {
  registry.register(definition);
}

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  skipped?: boolean;
}

const results: TestResult[] = [];

// Helper to run a test
async function test(
  name: string,
  fn: () => Promise<void>,
  skip = false,
): Promise<void> {
  if (skip) {
    results.push({ name, passed: true, duration: 0, skipped: true });
    console.log(`⏭️  SKIP: ${name}`);
    return;
  }

  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ PASS: ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    console.log(`❌ FAIL: ${name} (${duration}ms)`);
    console.log(`   Error: ${errorMsg}`);
  }
}

// Check if an API key is available
function hasApiKey(envVar: string | string[]): boolean {
  const vars = Array.isArray(envVar) ? envVar : [envVar];
  return vars.some((v) => !!process.env[v]);
}

// ============================================================================
// Registry Tests
// ============================================================================

console.log("\n📋 REGISTRY TESTS\n");

await test("registry has models registered", async () => {
  const models = registry.list("model");
  if (models.length === 0) throw new Error("No models registered");
  console.log(`   Found ${models.length} models`);
});

await test("registry has actions registered", async () => {
  const actions = registry.list("action");
  if (actions.length === 0) throw new Error("No actions registered");
  console.log(`   Found ${actions.length} actions`);
});

await test("registry has skills registered", async () => {
  const skills = registry.list("skill");
  if (skills.length === 0) throw new Error("No skills registered");
  console.log(`   Found ${skills.length} skills`);
});

await test("registry has providers registered", async () => {
  const providerList = providers.all();
  if (providerList.length === 0) throw new Error("No providers registered");
  console.log(`   Found ${providerList.length} providers`);
});

await test("registry resolves 'video' action", async () => {
  const video = registry.resolve("video");
  if (!video) throw new Error("Could not resolve 'video'");
  if (video.type !== "action") throw new Error("Expected action type");
});

await test("registry resolves 'kling' model", async () => {
  const kling = registry.resolve("kling");
  if (!kling) throw new Error("Could not resolve 'kling'");
  if (kling.type !== "model") throw new Error("Expected model type");
});

await test("registry resolves 'talking-character' skill", async () => {
  const skill = registry.resolve("talking-character");
  if (!skill) throw new Error("Could not resolve 'talking-character'");
  if (skill.type !== "skill") throw new Error("Expected skill type");
});

await test("registry search works", async () => {
  const searchResults = registry.search("video");
  if (searchResults.length === 0) throw new Error("No search results");
  console.log(`   Found ${searchResults.length} results for 'video'`);
});

// ============================================================================
// Provider Tests
// ============================================================================

console.log("\n🔌 PROVIDER TESTS\n");

await test("fal provider is registered", async () => {
  const fal = providers.get("fal");
  if (!fal) throw new Error("Fal provider not found");
});

await test("replicate provider is registered", async () => {
  const replicate = providers.get("replicate");
  if (!replicate) throw new Error("Replicate provider not found");
});

await test("elevenlabs provider is registered", async () => {
  const el = providers.get("elevenlabs");
  if (!el) throw new Error("ElevenLabs provider not found");
});

await test("groq provider is registered", async () => {
  const groq = providers.get("groq");
  if (!groq) throw new Error("Groq provider not found");
});

await test("ffmpeg provider is registered", async () => {
  const ffmpeg = providers.get("ffmpeg");
  if (!ffmpeg) throw new Error("FFmpeg provider not found");
});

await test("storage provider is registered", async () => {
  const storage = providers.get("storage");
  if (!storage) throw new Error("Storage provider not found");
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

console.log("\n📝 SCHEMA VALIDATION TESTS\n");

await test("validator accepts valid inputs", async () => {
  const def = registry.resolve("video");
  if (!def) throw new Error("No definition");

  // Use the input schema directly
  const result = validateInputs({ prompt: "test video" }, def.schema.input);
  if (!result.valid)
    throw new Error(
      `Validation failed: ${result.errors.map((e) => e.message).join(", ")}`,
    );
});

await test("validator rejects missing required fields", async () => {
  const def = registry.resolve("video");
  if (!def) throw new Error("No definition");

  const result = validateInputs({}, def.schema.input);
  if (result.valid) throw new Error("Should have failed validation");
  if (!result.errors.some((e) => e.path === "prompt")) {
    throw new Error("Should report missing 'prompt' field");
  }
});

await test("validator applies defaults", async () => {
  const def = registry.resolve("video");
  if (!def) throw new Error("No definition");

  const inputs = applyDefaults({ prompt: "test" }, def.schema.input);
  // Check that duration and aspectRatio have defaults applied
  const { properties } = getCliSchemaInfo(def.schema.input);
  if (properties.duration?.default !== undefined) {
    console.log(`   Defaults applied: duration=${inputs.duration}`);
  }
});

// ============================================================================
// Model Definition Tests
// ============================================================================

console.log("\n🤖 MODEL DEFINITION TESTS\n");

const modelNames = [
  "kling",
  "flux",
  "wan",
  "whisper",
  "elevenlabs-tts",
  "soul",
  "sonauto",
  "llama",
];

for (const name of modelNames) {
  await test(`model '${name}' is properly defined`, async () => {
    const model = registry.getModel(name);
    if (!model) throw new Error(`Model '${name}' not found`);
    if (!model.providers || model.providers.length === 0) {
      throw new Error("Model has no providers");
    }
    if (!model.defaultProvider) {
      throw new Error("Model has no default provider");
    }
    if (!model.schema) {
      throw new Error("Model has no schema");
    }
    console.log(
      `   Providers: ${model.providers.join(", ")}, default: ${model.defaultProvider}`,
    );
  });
}

// ============================================================================
// Action Definition Tests
// ============================================================================

console.log("\n⚡ ACTION DEFINITION TESTS\n");

const actionNames = [
  "video",
  "image",
  "voice",
  "transcribe",
  "music",
  "sync",
  "captions",
  "trim",
  "cut",
  "merge",
  "split",
  "fade",
  "transition",
  "remove",
];

for (const name of actionNames) {
  await test(`action '${name}' is properly defined`, async () => {
    const action = registry.getAction(name);
    if (!action) throw new Error(`Action '${name}' not found`);
    if (!action.schema) {
      throw new Error("Action has no schema");
    }
    if (!action.routes && !action.execute) {
      throw new Error("Action has no routes or execute function");
    }
    const hasRoutes = action.routes && action.routes.length > 0;
    const hasExecute = !!action.execute;
    console.log(`   Routes: ${hasRoutes}, Execute: ${hasExecute}`);
  });
}

// ============================================================================
// Skill Definition Tests
// ============================================================================

console.log("\n🎯 SKILL DEFINITION TESTS\n");

const skillNames = ["talking-character", "text-to-tiktok"];

for (const name of skillNames) {
  await test(`skill '${name}' is properly defined`, async () => {
    const skill = registry.getSkill(name);
    if (!skill) throw new Error(`Skill '${name}' not found`);
    if (!skill.steps || skill.steps.length === 0) {
      throw new Error("Skill has no steps");
    }
    console.log(`   Steps: ${skill.steps.length}`);
    for (const step of skill.steps) {
      console.log(`      - ${step.name} → ${step.run}`);
    }
  });
}

// ============================================================================
// Live API Tests (require API keys)
// ============================================================================

console.log("\n🌐 LIVE API TESTS (requires API keys)\n");

// Fal.ai tests
await test(
  "fal: generate image with flux",
  async () => {
    const { falProvider } = await import("../providers/fal");
    const result = await falProvider.generateImage({
      prompt: "a cute cat sitting on a rainbow",
      imageSize: "square",
    });
    if (!result?.data?.images?.[0]?.url) {
      throw new Error("No image URL in result");
    }
    console.log(`   Generated: ${result.data.images[0].url}`);
  },
  !hasApiKey("FAL_KEY"),
);

await test(
  "fal: text-to-video with kling",
  async () => {
    const { falProvider } = await import("../providers/fal");
    const result = await falProvider.textToVideo({
      prompt: "ocean waves crashing on beach",
      duration: 5,
    });
    if (!result?.data?.video?.url) {
      throw new Error("No video URL in result");
    }
    console.log(`   Generated: ${result.data.video.url}`);
  },
  !hasApiKey("FAL_KEY"),
);

// Replicate tests
await test(
  "replicate: run flux image generation",
  async () => {
    const { replicateProvider, MODELS } = await import(
      "../providers/replicate"
    );
    const result = await replicateProvider.runImage({
      model: MODELS.IMAGE.FLUX_SCHNELL,
      input: { prompt: "a mountain landscape at sunset" },
    });
    console.log(`   Generated: ${JSON.stringify(result).slice(0, 100)}...`);
  },
  !hasApiKey("REPLICATE_API_TOKEN"),
);

// ElevenLabs tests
await test(
  "elevenlabs: text-to-speech",
  async () => {
    const { elevenlabsProvider } = await import("../providers/elevenlabs");
    const buffer = await elevenlabsProvider.textToSpeech({
      text: "Hello, this is a test of the varg SDK.",
    });
    if (buffer.length === 0) {
      throw new Error("Empty audio buffer");
    }
    console.log(`   Generated: ${buffer.length} bytes of audio`);
  },
  !hasApiKey("ELEVENLABS_API_KEY"),
);

await test(
  "elevenlabs: list voices",
  async () => {
    const { elevenlabsProvider } = await import("../providers/elevenlabs");
    const voices = await elevenlabsProvider.listVoices();
    if (voices.length === 0) {
      throw new Error("No voices found");
    }
    console.log(`   Found ${voices.length} voices`);
  },
  !hasApiKey("ELEVENLABS_API_KEY"),
);

// Groq tests
await test(
  "groq: chat completion",
  async () => {
    const { groqProvider } = await import("../providers/groq");
    const result = await groqProvider.chatCompletion({
      messages: [{ role: "user", content: "Say hello in one word" }],
      maxTokens: 10,
    });
    if (!result) {
      throw new Error("No response");
    }
    console.log(`   Response: ${result}`);
  },
  !hasApiKey("GROQ_API_KEY"),
);

await test(
  "groq: list models",
  async () => {
    const { groqProvider } = await import("../providers/groq");
    const models = await groqProvider.listModels();
    if (models.length === 0) {
      throw new Error("No models found");
    }
    console.log(`   Found ${models.length} models`);
  },
  !hasApiKey("GROQ_API_KEY"),
);

// Higgsfield tests
await test(
  "higgsfield: list soul styles",
  async () => {
    const { higgsfieldProvider } = await import("../providers/higgsfield");
    const styles = await higgsfieldProvider.listSoulStyles();
    console.log(`   Found styles: ${JSON.stringify(styles).slice(0, 100)}...`);
  },
  !hasApiKey(["HIGGSFIELD_API_KEY", "HF_API_KEY"]),
);

// FFmpeg tests (local, no API needed)
await test("ffmpeg: probe video info", async () => {
  const { ffmpegProvider } = await import("../providers/ffmpeg");
  // This test requires a local video file - skip if not available
  const testVideo = "./media/test.mp4";
  const file = Bun.file(testVideo);
  if (!(await file.exists())) {
    console.log(`   Skipped: No test video at ${testVideo}`);
    return;
  }
  const info = await ffmpegProvider.probe(testVideo);
  console.log(`   Video: ${info.width}x${info.height}, ${info.duration}s`);
});

// ============================================================================
// Executor Tests
// ============================================================================

console.log("\n🚀 EXECUTOR TESTS\n");

await test(
  "executor: run image action",
  async () => {
    const result = await executor.run("image", {
      prompt: "a beautiful sunset over mountains",
      size: "landscape_4_3",
    });
    if (!result.output) {
      throw new Error("No output");
    }
    console.log(`   Output: ${JSON.stringify(result.output).slice(0, 100)}...`);
  },
  !hasApiKey("FAL_KEY"),
);

await test(
  "executor: run voice action",
  async () => {
    const result = await executor.run("voice", {
      text: "Hello from the varg SDK executor test.",
    });
    if (!result.output) {
      throw new Error("No output");
    }
    console.log(`   Duration: ${result.duration}ms`);
  },
  !hasApiKey("ELEVENLABS_API_KEY"),
);

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${"=".repeat(60)}`);
console.log("TEST SUMMARY");
console.log(`${"=".repeat(60)}\n`);

const passed = results.filter((r) => r.passed && !r.skipped).length;
const failed = results.filter((r) => !r.passed).length;
const skipped = results.filter((r) => r.skipped).length;
const total = results.length;

console.log(`Total:   ${total}`);
console.log(`Passed:  ${passed} ✅`);
console.log(`Failed:  ${failed} ❌`);
console.log(`Skipped: ${skipped} ⏭️`);
console.log("");

if (failed > 0) {
  console.log("Failed tests:");
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`  - ${r.name}: ${r.error}`);
  }
  console.log("");
}

const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
console.log(`Total time: ${totalDuration}ms`);
console.log("");

// Exit with error code if any tests failed
if (failed > 0) {
  process.exit(1);
}
