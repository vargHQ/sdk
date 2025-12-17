/**
 * Pipeline Runner
 * Executes multi-step skills/workflows
 */

import type {
  ExecutionResult,
  RunOptions,
  SkillDefinition,
  SkillStep,
} from "../schema/types";

export interface PipelineContext {
  /** Initial inputs provided to the pipeline */
  inputs: Record<string, unknown>;
  /** Results from each completed step, keyed by step name */
  results: Record<string, unknown>;
  /** Current step index */
  stepIndex: number;
  /** Total number of steps */
  totalSteps: number;
}

export interface PipelineOptions extends RunOptions {
  /** If true, stop on first error */
  stopOnError?: boolean;
  /** Step-level callback */
  onStepStart?: (step: SkillStep, context: PipelineContext) => void;
  /** Step completion callback */
  onStepComplete?: (
    step: SkillStep,
    result: unknown,
    context: PipelineContext,
  ) => void;
}

export type StepExecutor = (
  name: string,
  inputs: Record<string, unknown>,
  options?: RunOptions,
) => Promise<ExecutionResult>;

export class PipelineRunner {
  /**
   * Execute a skill definition
   */
  async run(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    executor: StepExecutor,
    options?: PipelineOptions,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const context: PipelineContext = {
      inputs,
      results: {},
      stepIndex: 0,
      totalSteps: skill.steps.length,
    };

    console.log(`[pipeline] starting skill: ${skill.name}`);
    console.log(`[pipeline] steps: ${skill.steps.length}`);

    let lastResult: ExecutionResult | null = null;

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      if (!step) continue;

      context.stepIndex = i;

      // Check step condition
      if (step.when && !this.evaluateCondition(step.when, context)) {
        console.log(
          `[pipeline] skipping step ${i + 1}: ${step.name} (condition not met)`,
        );
        continue;
      }

      console.log(
        `[pipeline] step ${i + 1}/${skill.steps.length}: ${step.name}`,
      );

      if (options?.onStepStart) {
        options.onStepStart(step, context);
      }

      try {
        // Resolve inputs for this step
        const stepInputs = this.resolveInputs(step.inputs, context);

        // Execute the step
        const result = await executor(step.run, stepInputs, options);

        // Store result
        context.results[step.name] = result.output;
        lastResult = result;

        if (options?.onStepComplete) {
          options.onStepComplete(step, result, context);
        }

        console.log(`[pipeline] step ${step.name} completed`);
      } catch (error) {
        console.error(`[pipeline] step ${step.name} failed:`, error);

        if (options?.stopOnError !== false) {
          throw error;
        }

        // Store error as result
        context.results[step.name] = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[pipeline] skill ${skill.name} completed in ${duration}ms`);

    return {
      output: lastResult?.output ?? context.results,
      duration,
      provider: lastResult?.provider ?? "pipeline",
      model: skill.name,
      metadata: {
        stepResults: context.results,
      },
    };
  }

  /**
   * Evaluate a condition against the current context
   */
  private evaluateCondition(
    condition: Record<string, unknown>,
    context: PipelineContext,
  ): boolean {
    for (const [key, expected] of Object.entries(condition)) {
      const actual = this.resolveValue(key, context);

      // Simple equality check
      if (actual !== expected) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolve inputs for a step, substituting references
   */
  private resolveInputs(
    inputs: Record<string, unknown>,
    context: PipelineContext,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      resolved[key] = this.resolveValue(value, context);
    }

    return resolved;
  }

  /**
   * Resolve a value, handling references like $inputs.foo or $results.step1.output
   */
  private resolveValue(value: unknown, context: PipelineContext): unknown {
    if (typeof value !== "string") {
      return value;
    }

    // Check for reference syntax
    if (!value.startsWith("$")) {
      return value;
    }

    const path = value.slice(1).split(".");
    const source = path[0];
    const rest = path.slice(1);

    let current: unknown;

    switch (source) {
      case "inputs":
        current = context.inputs;
        break;
      case "results":
        current = context.results;
        break;
      default:
        // Check if it's a direct step result reference
        if (context.results[source] !== undefined) {
          current = context.results[source];
        } else {
          return value; // Return as-is if not a valid reference
        }
    }

    // Navigate the path
    for (const part of rest) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

// Global pipeline runner instance
export const pipelineRunner = new PipelineRunner();
