import type { VargElement } from "../types";
import { addComposeStep, createCompileContext, walkTree } from "./discover";
import { isVargElement } from "./helpers";
import { topoSort } from "./topo-sort";
import { CompiledPlan } from "./types";

/**
 * Compile a VargElement tree into an ordered, validated execution plan.
 *
 * Read-only: never triggers generation. Pre-resolved elements (from
 * `await Video(...)` etc.) become Steps with status "skipped".
 *
 * Pipeline: validate root → walk tree (discover steps + deps) → add
 * compose step → topological sort → return CompiledPlan.
 *
 * ```tsx
 * const plan = compile(tree);
 * if (plan.hasErrors()) throw new Error(plan.errors[0].message);
 * for (const step of plan.steps) console.log(step.kind, step.label);
 * ```
 */
export function compile(root: VargElement): CompiledPlan {
  const ctx = createCompileContext();

  if (root.type !== "render") {
    ctx.addDiagnostic(
      "error",
      "VARG_ROOT_NOT_RENDER",
      `Root element must be <Render>, got <${root.type}>`,
      [root.type],
    );
    return new CompiledPlan([], ctx.diagnostics);
  }

  // Walk the tree: discover all generable steps and compose dependencies.
  let clipIdx = 0;
  for (const child of root.children) {
    const idx =
      isVargElement(child) && child.type === "clip" ? clipIdx++ : undefined;
    walkTree(child, ["render"], ctx, idx);
  }

  // Final compose step (editly composition) depends on everything.
  addComposeStep(root, ctx);

  // Topological sort: dependencies before dependents.
  let ordered: typeof ctx.steps;
  try {
    ordered = topoSort(ctx.steps);
  } catch (err) {
    ctx.addDiagnostic(
      "error",
      "VARG_CIRCULAR_DEPENDENCY",
      err instanceof Error ? err.message : String(err),
      ["render"],
    );
    ordered = ctx.steps;
  }

  return new CompiledPlan(ordered, ctx.diagnostics);
}
