import { computeCacheKey } from "../renderers/utils";
import type { VargElement, VargNode } from "../types";
import { CONTAINER_TYPES, OP_BY_TYPE } from "./constants";
import { getLabel, isPreResolved, isVargElement } from "./helpers";
import type { Diagnostic, Step } from "./types";
import { type DiagnosticAdder, validateElement } from "./validate";

/**
 * Mutable state shared across the discovery pass: accumulated steps,
 * diagnostics, and a dedup map from element → step.
 */
export interface CompileContext {
  steps: Step[];
  diagnostics: Diagnostic[];
  stepByElement: Map<VargElement, Step>;
  composeDeps: Step[];
  counter: number;
  addDiagnostic: DiagnosticAdder;
}

export function createCompileContext(): CompileContext {
  const diagnostics: Diagnostic[] = [];
  const ctx: CompileContext = {
    steps: [],
    diagnostics,
    stepByElement: new Map(),
    composeDeps: [],
    counter: 0,
    addDiagnostic: (severity, code, message, path) => {
      diagnostics.push({ severity, code, message, path });
    },
  };
  return ctx;
}

/**
 * Register a Step for a generable element and return it.
 * Recursively discovers dependencies in nested prompt props / children.
 * Shared elements (same reference) map to a single step.
 */
export function addStep(
  element: VargElement,
  path: string[],
  ctx: CompileContext,
): Step {
  const existing = ctx.stepByElement.get(element);
  if (existing) return existing;

  const kind = OP_BY_TYPE[element.type];
  if (!kind) {
    throw new Error(`No op kind for element type "${element.type}"`);
  }

  validateElement(element, path, ctx.addDiagnostic);

  const step: Step = {
    id: `step-${ctx.counter++}`,
    kind,
    element,
    dependsOn: [],
    cacheKey: computeCacheKey(element).join(":"),
    status: isPreResolved(element) ? "skipped" : "pending",
    label: getLabel(element),
    path,
  };
  ctx.stepByElement.set(element, step);
  ctx.steps.push(step);

  // Discover dependencies in prompt props
  const prompt = element.props.prompt;
  if (prompt && typeof prompt === "object") {
    const p = prompt as Record<string, unknown>;
    if (Array.isArray(p.images)) {
      for (const img of p.images) {
        if (isVargElement(img)) {
          step.dependsOn.push(addStep(img, [...path, "prompt.images"], ctx));
        }
      }
    }
    for (const key of ["audio", "video"] as const) {
      const v = p[key];
      if (isVargElement(v)) {
        step.dependsOn.push(addStep(v, [...path, `prompt.${key}`], ctx));
      }
    }
  }

  // TalkingHead: image / audio props
  for (const key of ["image", "audio"] as const) {
    const v = element.props[key];
    if (isVargElement(v)) {
      step.dependsOn.push(addStep(v, [...path, key], ctx));
    }
  }

  // Slice / FFmpeg / Probe / Audio: src prop may be an element
  const src = element.props.src;
  if (isVargElement(src)) {
    step.dependsOn.push(addStep(src, [...path, "src"], ctx));
  }
  // Audio element: parent video reference
  const parent = element.props.parent;
  if (isVargElement(parent)) {
    step.dependsOn.push(addStep(parent, [...path, "parent"], ctx));
  }

  return step;
}

/**
 * Walk the render tree top-down (DFS), registering generable elements as
 * steps and collecting compose dependencies. Container types are recursed
 * into; leaf generable types are registered via addStep.
 */
export function walkTree(
  node: VargNode,
  path: string[],
  ctx: CompileContext,
  clipIndex?: number,
): void {
  if (node == null || typeof node === "string" || typeof node === "number")
    return;
  if (Array.isArray(node)) {
    for (const child of node) walkTree(child, path, ctx, clipIndex);
    return;
  }
  if (!isVargElement(node)) return;

  const element = node;
  const label =
    element.type === "clip" && clipIndex !== undefined
      ? `clip[${clipIndex}]`
      : element.type;
  const currentPath = [...path, label];

  // Generable element → register as a step + compose dependency
  if (OP_BY_TYPE[element.type]) {
    ctx.composeDeps.push(addStep(element, currentPath, ctx));
    return;
  }

  // Captions: src may be a generable element
  if (element.type === "captions") {
    const src = element.props.src;
    if (isVargElement(src)) {
      ctx.composeDeps.push(addStep(src, [...currentPath, "src"], ctx));
    }
    return;
  }

  // Packshot: background and logo may be generable elements
  if (element.type === "packshot") {
    for (const key of ["background", "logo"] as const) {
      const v = element.props[key];
      if (isVargElement(v)) {
        ctx.composeDeps.push(addStep(v, [...currentPath, key], ctx));
      }
    }
    return;
  }

  // Unresolved async component — warn (should have been resolved by resolveLazy)
  if (element.type === "__lazy") {
    ctx.addDiagnostic(
      "warning",
      "VARG_UNRESOLVED_LAZY",
      "Tree contains an unresolved async component — call resolveLazy() before compile() for a complete plan",
      currentPath,
    );
    return;
  }

  // Container types: recurse into children
  if (CONTAINER_TYPES.has(element.type)) {
    if (element.type === "clip") {
      const d = element.props.duration;
      if (d === undefined || d === "auto") {
        const hasMedia = element.children.some(
          (c) => isVargElement(c) && (c.type === "video" || c.type === "image"),
        );
        if (!hasMedia || d === undefined) {
          ctx.addDiagnostic(
            "info",
            "VARG_DURATION_DEFAULT",
            `<Clip> without a numeric duration falls back to 3s at render time`,
            currentPath,
          );
        }
      }
    }
    let childClipIndex = 0;
    for (const child of element.children) {
      const idx =
        isVargElement(child) && child.type === "clip"
          ? childClipIndex++
          : undefined;
      walkTree(child, currentPath, ctx, idx);
    }
  }
}

/**
 * Append the final compose step (editly composition) that depends on
 * every generable step discovered during the walk.
 */
export function addComposeStep(root: VargElement, ctx: CompileContext): Step {
  const step: Step = {
    id: `step-${ctx.counter++}`,
    kind: "compose",
    element: root,
    dependsOn: ctx.composeDeps,
    cacheKey: "",
    status: "pending",
    label: "compose",
    path: ["render"],
  };
  ctx.steps.push(step);
  return step;
}
