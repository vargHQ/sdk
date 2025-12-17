/**
 * Main Execution Orchestrator
 * Routes execution to appropriate handlers based on definition type
 */

import { registry } from "../registry/registry";
import { resolve } from "../registry/resolver";
import type {
  ActionDefinition,
  Definition,
  ExecutionResult,
  ModelDefinition,
  RunOptions,
  SkillDefinition,
} from "../schema/types";
import { validateAndPrepare } from "../schema/validator";
import { jobRunner } from "./job";
import { pipelineRunner } from "./pipeline";

export class Executor {
  /**
   * Run a definition by name
   */
  async run(
    name: string,
    inputs: Record<string, unknown>,
    options?: RunOptions,
  ): Promise<ExecutionResult> {
    // Resolve name to definition
    const result = resolve(name, { required: true });
    const definition = result.definition!;

    // Validate and prepare inputs
    const validation = validateAndPrepare(inputs, definition.schema);
    if (!validation.valid) {
      throw new Error(
        `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
      );
    }

    // Route to appropriate handler
    switch (definition.type) {
      case "model":
        return this.runModel(definition, validation.inputs, options);
      case "action":
        return this.runAction(definition, validation.inputs, options);
      case "skill":
        return this.runSkill(definition, validation.inputs, options);
      default:
        throw new Error(
          `Unknown definition type: ${(definition as Definition).type}`,
        );
    }
  }

  /**
   * Run a model directly
   */
  async runModel(
    model: ModelDefinition,
    inputs: Record<string, unknown>,
    options?: RunOptions,
  ): Promise<ExecutionResult> {
    console.log(`[executor] running model: ${model.name}`);

    // Determine provider
    const providerName = options?.provider ?? model.defaultProvider;
    const provider = registry.getProvider(providerName);

    if (!provider) {
      throw new Error(
        `Provider not found: ${providerName}. Available: ${registry
          .listProviders()
          .map((p) => p.name)
          .join(", ")}`,
      );
    }

    // Get provider-specific model ID
    const providerModelId = model.providerModels?.[providerName] ?? model.name;

    // Run via job runner
    return jobRunner.run({
      provider,
      model: providerModelId,
      inputs,
      options,
    });
  }

  /**
   * Run an action
   * Actions can route to models or have direct execution
   */
  async runAction(
    action: ActionDefinition,
    inputs: Record<string, unknown>,
    options?: RunOptions,
  ): Promise<ExecutionResult> {
    console.log(`[executor] running action: ${action.name}`);

    // If action has direct execute function, use it
    if (action.execute) {
      const startTime = Date.now();
      const output = await action.execute(inputs);

      return {
        output: output as string | Record<string, unknown>,
        duration: Date.now() - startTime,
        provider: "local",
        model: action.name,
      };
    }

    // Otherwise, route to a model
    const route = this.selectRoute(action, inputs, options);

    if (!route) {
      throw new Error(`No valid route found for action: ${action.name}`);
    }

    console.log(`[executor] routing to: ${route.target}`);

    // Transform inputs if needed
    const transformedInputs = route.transform
      ? route.transform(inputs)
      : inputs;

    // Recursive call to run the target
    return this.run(route.target, transformedInputs, options);
  }

  /**
   * Run a skill (multi-step pipeline)
   */
  async runSkill(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    options?: RunOptions,
  ): Promise<ExecutionResult> {
    console.log(`[executor] running skill: ${skill.name}`);

    return pipelineRunner.run(
      skill,
      inputs,
      (name, stepInputs, stepOptions) =>
        this.run(name, stepInputs, stepOptions),
      options,
    );
  }

  /**
   * Select the best route for an action based on inputs and conditions
   */
  private selectRoute(
    action: ActionDefinition,
    inputs: Record<string, unknown>,
    options?: RunOptions,
  ) {
    // Filter routes by conditions
    const validRoutes = action.routes.filter((route) => {
      if (!route.when) return true;

      // Check each condition
      for (const [key, expected] of Object.entries(route.when)) {
        const actual = inputs[key];

        // Handle special condition operators
        if (typeof expected === "object" && expected !== null) {
          const cond = expected as Record<string, unknown>;

          if ("$lt" in cond && !(Number(actual) < Number(cond.$lt)))
            return false;
          if ("$lte" in cond && !(Number(actual) <= Number(cond.$lte)))
            return false;
          if ("$gt" in cond && !(Number(actual) > Number(cond.$gt)))
            return false;
          if ("$gte" in cond && !(Number(actual) >= Number(cond.$gte)))
            return false;
          if ("$eq" in cond && actual !== cond.$eq) return false;
          if ("$ne" in cond && actual === cond.$ne) return false;
          if ("$in" in cond && !Array.isArray(cond.$in)) return false;
          if ("$in" in cond && !(cond.$in as unknown[]).includes(actual))
            return false;
        } else if (actual !== expected) {
          return false;
        }
      }

      return true;
    });

    // Sort by priority (higher = preferred)
    validRoutes.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Return the highest priority route
    return validRoutes[0];
  }
}

// Global executor instance
export const executor = new Executor();
