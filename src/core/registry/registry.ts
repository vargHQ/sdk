/**
 * Central Registry
 * The brain that knows about all models, actions, skills, and providers
 */

import { getCliSchemaInfo, toJsonSchema } from "../schema/helpers";
import type {
  ActionDefinition,
  Definition,
  ModelDefinition,
  Provider,
  SearchOptions,
  SkillDefinition,
} from "../schema/types";

export class Registry {
  private models = new Map<string, ModelDefinition>();
  private actions = new Map<string, ActionDefinition>();
  private skills = new Map<string, SkillDefinition>();
  private providers = new Map<string, Provider>();

  // ============================================================================
  // Registration
  // ============================================================================

  /**
   * Register a definition (model, action, or skill)
   */
  register(definition: Definition): void {
    switch (definition.type) {
      case "model":
        this.models.set(definition.name, definition);
        break;
      case "action":
        this.actions.set(definition.name, definition);
        break;
      case "skill":
        this.skills.set(definition.name, definition);
        break;
    }
  }

  /**
   * Register a provider
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.name, provider);
    console.log(`[registry] registered provider: ${provider.name}`);
  }

  /**
   * Unregister a definition by name
   */
  unregister(name: string): boolean {
    return (
      this.models.delete(name) ||
      this.actions.delete(name) ||
      this.skills.delete(name)
    );
  }

  // ============================================================================
  // Resolution
  // ============================================================================

  /**
   * Resolve a name to its definition
   * Resolution order: models -> actions -> skills
   */

  resolve(name: string): Definition | null {
    // Handle explicit namespace prefixes
    if (name.startsWith("model/")) {
      return this.models.get(name.slice(6)) ?? null;
    }
    if (name.startsWith("action/")) {
      return this.actions.get(name.slice(7)) ?? null;
    }
    if (name.startsWith("skill/")) {
      return this.skills.get(name.slice(6)) ?? null;
    }

    // Try each type in order
    return (
      this.models.get(name) ??
      this.actions.get(name) ??
      this.skills.get(name) ??
      null
    );
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a name exists
   */
  has(name: string): boolean {
    return this.resolve(name) !== null;
  }

  // ============================================================================
  // Search
  // ============================================================================

  /**
   * Search definitions by query string
   */
  search(query: string, options?: SearchOptions): Definition[] {
    const q = query.toLowerCase();
    const results: Definition[] = [];

    // Get all definitions based on type filter
    const definitions = this.list(options?.type);

    for (const def of definitions) {
      // Match by name or description
      if (
        def.name.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q)
      ) {
        results.push(def);
        continue;
      }

      // Match by input/output type (from schema)
      const inputSchema = getCliSchemaInfo(def.schema.input);
      const outputSchema = toJsonSchema(def.schema.output);
      const inputType = inputSchema.properties?.type?.type ?? "";
      const outputType = outputSchema.type ?? "";

      if (
        options?.inputType &&
        inputType.toLowerCase().includes(options.inputType.toLowerCase())
      ) {
        results.push(def);
        continue;
      }

      if (
        options?.outputType &&
        outputType.toLowerCase().includes(options.outputType.toLowerCase())
      ) {
        results.push(def);
        continue;
      }

      // Match by provider (for models)
      if (
        options?.provider &&
        def.type === "model" &&
        (def as ModelDefinition).providers.includes(options.provider)
      ) {
        results.push(def);
      }
    }

    return results;
  }

  /**
   * List all definitions, optionally filtered by type
   */
  list(type?: "model" | "action" | "skill"): Definition[] {
    const results: Definition[] = [];

    if (!type || type === "model") {
      results.push(...this.models.values());
    }
    if (!type || type === "action") {
      results.push(...this.actions.values());
    }
    if (!type || type === "skill") {
      results.push(...this.skills.values());
    }

    return results;
  }

  /**
   * List all providers
   */
  listProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getModel(name: string): ModelDefinition | undefined {
    return this.models.get(name);
  }

  getAction(name: string): ActionDefinition | undefined {
    return this.actions.get(name);
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  // ============================================================================
  // Stats
  // ============================================================================

  get stats() {
    return {
      models: this.models.size,
      actions: this.actions.size,
      skills: this.skills.size,
      providers: this.providers.size,
    };
  }
}

// Global registry instance
export const registry = new Registry();
