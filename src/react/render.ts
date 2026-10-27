import pLimit from "p-limit";
import { localBackend } from "../ai-sdk/providers/editly";
import { compile } from "./ir/compile";
import { executePlan } from "./ir/execute";
import { CompileError, type StepEvent } from "./ir/types";
import {
  createRenderContext,
  resolveCacheStorage,
} from "./renderers/context-builder";
import { renderRoot } from "./renderers/render";
import { resolveLazy } from "./renderers/resolve-lazy";
import { resolveConcurrency } from "./renderers/utils";
import { type ResolveContext, withResolveContext } from "./resolve-context";
import type { RenderOptions, RenderResult, VargElement } from "./types";

interface PreparedPlan {
  resolved: VargElement<"render">;
  plan: ReturnType<typeof compile>;
  resolveCtx: ResolveContext;
}

/**
 * Shared front half of render(): resolve async components, compile the
 * tree into a plan, and fail fast on validation errors.
 */
async function prepare(
  element: VargElement,
  options: RenderOptions,
): Promise<PreparedPlan> {
  const backend = options.backend ?? localBackend;
  const cache = resolveCacheStorage(options.cache);
  const resolveCtx: ResolveContext = {
    backend,
    cache,
    storage: options.storage,
    defaults: options.defaults,
    // Same knob and default as executePlan's `concurrency`: async
    // components generating during resolveLazy are subject to the same
    // budget as steps generating during executePlan. Previously this
    // phase was unbounded — a bypass, not a feature (sdk#225).
    limit: pLimit(resolveConcurrency(options.concurrency)),
  };

  // Resolve lazy elements (from async components) within the resolve context.
  // This makes backend/cache/storage available to `await Speech()` etc. via
  // AsyncLocalStorage, so they use the same infrastructure as the render pipeline.
  const resolved = (await withResolveContext(resolveCtx, () =>
    resolveLazy(element),
  )) as VargElement;

  if (resolved.type !== "render") {
    throw new Error("Root element must be <Render>");
  }

  // Compile the tree into an execution plan. Validation errors abort the
  // render before any generation money is spent.
  const plan = compile(resolved);
  if (plan.hasErrors()) {
    throw new CompileError(plan.diagnostics);
  }

  return { resolved: resolved as VargElement<"render">, plan, resolveCtx };
}

/**
 * Render a VargElement tree into a video.
 *
 * Pipeline: `resolveLazy` (async components) → `compile()` (plan +
 * validation) → `executePlan()` (generation in dependency order with
 * bounded parallelism) → `renderRoot()` (compose: timeline, editly,
 * captions burn-in).
 *
 * When async components use `await Speech()` / `await Video()` etc., the
 * resolve context provides them with the same backend, cache, and storage
 * as the render pipeline — enabling cloud rendering via Rendi or other backends.
 */
export async function render(
  element: VargElement,
  options: RenderOptions = {},
  onStepEvent?: (event: StepEvent) => void,
): Promise<RenderResult> {
  // Lifecycle hooks from <Render> props (React-style declarative callbacks).
  const renderProps = element.props as Partial<{
    onStep?: (event: StepEvent) => void;
    onComplete?: (result: RenderResult) => void;
    onError?: (error: Error) => void;
  }>;
  const onStep = onStepEvent ?? renderProps.onStep;

  try {
    const { resolved, plan, resolveCtx } = await prepare(element, options);

    // One shared context for both phases: executor fills element.meta and
    // pendingFiles; compose reuses the same files without re-generation.
    const prepared = createRenderContext(resolved, options);

    // throwOnError: false — failed steps leave rejected promises in
    // pendingFiles; the compose phase re-encounters them per clip and
    // aggregates with legacy "N of M clips failed" semantics, preserving
    // successful (cached) results.
    await withResolveContext(resolveCtx, () =>
      executePlan(plan, prepared.ctx, {
        concurrency: options.concurrency ?? 3,
        onEvent: onStep,
        throwOnError: false,
      }),
    );

    const result = await withResolveContext(resolveCtx, () =>
      renderRoot(resolved, options, prepared),
    );

    renderProps.onComplete?.(result);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    renderProps.onError?.(err);
    throw err;
  }
}

export type RenderStreamEvent =
  | { type: "start"; progress: number }
  | {
      type: "step";
      progress: number;
      event: StepEvent;
    }
  | { type: "complete"; progress: number; result: RenderResult };

/** Streaming render interface that yields per-step progress events. */
export const renderStream = {
  /** Stream render progress: plan/step lifecycle events from the executor,
   *  with progress as the fraction of completed steps. */
  async *stream(
    element: VargElement,
    options: RenderOptions = {},
  ): AsyncGenerator<RenderStreamEvent> {
    yield { type: "start", progress: 0 };

    const events: StepEvent[] = [];
    let notify: (() => void) | undefined;
    let settled = false;

    const push = (event: StepEvent) => {
      events.push(event);
      notify?.();
    };

    const resultPromise = render(element, options, push).then(
      (result) => {
        settled = true;
        notify?.();
        return { ok: true as const, result };
      },
      (error) => {
        settled = true;
        notify?.();
        return { ok: false as const, error };
      },
    );

    let totalSteps = 0;
    let completed = 0;
    let cursor = 0;

    while (true) {
      while (cursor < events.length) {
        const event = events[cursor++]!;
        if (event.type === "plan") {
          totalSteps = event.totalSteps ?? 0;
        } else if (
          event.type === "step-complete" ||
          event.type === "step-skipped"
        ) {
          completed++;
        }
        const progress =
          totalSteps > 0
            ? Math.min(99, Math.round((completed / totalSteps) * 95))
            : 0;
        yield { type: "step", progress, event };
      }
      if (settled) break;
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
      notify = undefined;
    }

    const outcome = await resultPromise;
    if (!outcome.ok) throw outcome.error;
    yield { type: "complete", progress: 100, result: outcome.result };
  },
};
