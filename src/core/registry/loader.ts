/**
 * Definition Loader
 * Auto-loads definitions from the definitions/ directory
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Definition } from "../schema/types";
import { registry } from "./registry";

const DEFINITIONS_DIR = join(import.meta.dir, "..", "..", "definitions");

export interface LoaderOptions {
  /** Additional paths to scan for definitions */
  additionalPaths?: string[];
  /** If true, log loading progress */
  verbose?: boolean;
}

/**
 * Load all definitions from the definitions directory
 */
export async function loadDefinitions(options?: LoaderOptions): Promise<void> {
  const { verbose = false } = options ?? {};

  // Load built-in definitions
  await loadFromDirectory(join(DEFINITIONS_DIR, "models"), verbose);
  await loadFromDirectory(join(DEFINITIONS_DIR, "actions"), verbose);
  await loadFromDirectory(join(DEFINITIONS_DIR, "skills"), verbose);

  // Load from additional paths
  if (options?.additionalPaths) {
    for (const path of options.additionalPaths) {
      await loadFromDirectory(path, verbose);
    }
  }

  if (verbose) {
    console.log(`[loader] loaded: ${JSON.stringify(registry.stats)}`);
  }
}

/**
 * Load definitions from a directory
 */
async function loadFromDirectory(
  dirPath: string,
  verbose: boolean,
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip non-TypeScript files
      if (!entry.isFile() || !entry.name.endsWith(".ts")) {
        continue;
      }

      // Skip index files
      if (entry.name === "index.ts") {
        continue;
      }

      try {
        const modulePath = join(dirPath, entry.name);
        const mod = await import(modulePath);

        // Check for definition export (named 'definition' or default)
        const definition: Definition | undefined =
          mod.definition ?? mod.default;

        if (definition && isValidDefinition(definition)) {
          registry.register(definition);
          if (verbose) {
            console.log(
              `[loader] loaded: ${definition.name} (${definition.type})`,
            );
          }
        }

        // Also check for meta export (backward compatibility with action format)
        if (mod.meta && isValidDefinition(mod.meta)) {
          registry.register(mod.meta);
          if (verbose) {
            console.log(`[loader] loaded: ${mod.meta.name} (${mod.meta.type})`);
          }
        }
      } catch (error) {
        if (verbose) {
          console.warn(
            `[loader] failed to load ${entry.name}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist - that's okay
    if (verbose && (error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[loader] error reading ${dirPath}:`, error);
    }
  }
}

/**
 * Check if an object is a valid definition
 */
function isValidDefinition(obj: unknown): obj is Definition {
  if (!obj || typeof obj !== "object") return false;

  const def = obj as Record<string, unknown>;

  return (
    typeof def.type === "string" &&
    ["model", "action", "skill"].includes(def.type) &&
    typeof def.name === "string" &&
    typeof def.description === "string" &&
    typeof def.schema === "object"
  );
}

/**
 * Load user skills from ~/.varg/skills/
 */
export async function loadUserSkills(verbose = false): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const userSkillsDir = join(homeDir, ".varg", "skills");

  await loadFromDirectory(userSkillsDir, verbose);
}

/**
 * Reload all definitions (useful for hot-reloading)
 */
export async function reloadDefinitions(
  options?: LoaderOptions,
): Promise<void> {
  // Clear existing definitions (but keep providers)
  const stats = registry.stats;

  if (options?.verbose) {
    console.log(
      `[loader] clearing ${stats.models + stats.actions + stats.skills} definitions...`,
    );
  }

  // Re-load everything
  await loadDefinitions(options);
}
