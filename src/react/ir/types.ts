import type { VargElement } from "../types";

/**
 * Intermediate representation (IR) for a compiled render plan.
 *
 * `compile()` turns a VargElement tree into an ordered list of Steps —
 * a step-by-step execution instruction with dependencies, validation
 * diagnostics, and cache keys. The plan is read-only: it never triggers
 * generation.
 */

/** The kind of operation a Step performs. */
export type OpKind =
  | "generate-image"
  | "generate-video"
  | "generate-speech"
  | "generate-music"
  | "talking-head"
  | "extract-audio"
  | "transcribe"
  | "silence-detect"
  | "slice"
  | "ffmpeg"
  | "probe"
  | "compose";

export type StepId = string;

/**
 * Step lifecycle status.
 * - `pending` — not started
 * - `running` — currently executing
 * - `done` — finished successfully
 * - `failed` — errored
 * - `skipped` — no work needed (pre-resolved via `await` or cache hit)
 */
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** A single unit of work in the compiled plan. */
export interface Step {
  id: StepId;
  kind: OpKind;
  /** The element this step materializes. */
  element: VargElement;
  /** Steps that must complete before this one can run (object references). */
  dependsOn: Step[];
  /** Cache key for the step's result (computeCacheKey of the element). */
  cacheKey: string;
  status: StepStatus;
  /** Human-readable label, e.g. `video: "sunset over ocean..."`. */
  label: string;
  /** Path in the source tree, e.g. ["render", "clip[1]", "video"]. */
  path: string[];
}

export type DiagnosticSeverity = "error" | "warning" | "info";

/** A validation finding produced by `compile()`. */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  /** Stable machine-readable code, e.g. "VARG_AUDIO_CONFLICT". */
  code: string;
  message: string;
  /** Path in the source tree where the finding applies. */
  path: string[];
  /** Step this diagnostic refers to, when applicable. */
  stepId?: StepId;
}

/** Serializable form of a Step (references become ids). */
export interface SerializedStep {
  id: StepId;
  kind: OpKind;
  dependsOn: StepId[];
  cacheKey: string;
  status: StepStatus;
  label: string;
  path: string[];
  elementType: string;
}

export interface SerializedPlan {
  steps: SerializedStep[];
  diagnostics: Diagnostic[];
}

/** Lifecycle event emitted by `executePlan()` for each step. */
export interface StepEvent {
  type:
    | "plan"
    | "step-start"
    | "step-complete"
    | "step-failed"
    | "step-skipped";
  /** The step this event refers to (absent for "plan"). */
  step?: Step;
  /** Total number of executable steps (present on "plan"). */
  totalSteps?: number;
  /** The failure (present on "step-failed"). */
  error?: Error;
}

/** Thrown by render() when compile() finds validation errors. */
export class CompileError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    const errors = diagnostics.filter((d) => d.severity === "error");
    super(
      `Composition failed validation with ${errors.length} error(s):\n${errors
        .map((d) => `  [${d.code}] ${d.message} (at ${d.path.join(" > ")})`)
        .join("\n")}`,
    );
    this.name = "CompileError";
    this.diagnostics = diagnostics;
  }
}

/** Result of `compile()` — ordered steps plus validation diagnostics. */
export class CompiledPlan {
  /** Steps in topological order (dependencies before dependents). */
  readonly steps: Step[];
  readonly diagnostics: Diagnostic[];

  constructor(steps: Step[], diagnostics: Diagnostic[]) {
    this.steps = steps;
    this.diagnostics = diagnostics;
  }

  hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === "error");
  }

  get errors(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "error");
  }

  get warnings(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "warning");
  }

  /** Serialize for JSON output (CLI --dry-run, Studio, snapshots). */
  toJSON(): SerializedPlan {
    return {
      steps: this.steps.map((s) => ({
        id: s.id,
        kind: s.kind,
        dependsOn: s.dependsOn.map((d) => d.id),
        cacheKey: s.cacheKey,
        status: s.status,
        label: s.label,
        path: s.path,
        elementType: s.element.type,
      })),
      diagnostics: this.diagnostics,
    };
  }
}
