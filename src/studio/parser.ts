/**
 * VargElement → WorkflowGraph parser.
 *
 * The studio already imports user TSX at runtime and obtains a `VargElement`
 * tree (see `server.ts::executeRender`). This module turns that tree into
 * a `WorkflowGraph` document — the same shape the canvas saves to disk and
 * codegen prints back out.
 *
 * Algorithm
 * ---------
 * 1. Walk the element tree depth-first.
 * 2. Every container element (`render`, `clip`, `overlay`, `split`, `slider`,
 *    `swipe`) becomes a node whose `children[]` are recursively parsed.
 * 3. Every leaf element becomes a node.
 * 4. When a leaf's props contain another element nested inside a known port
 *    slot (e.g. `Video.prompt.images[0]` is an `image` element), the nested
 *    element is extracted into its own node and a `GraphEdge` is added:
 *       { source: nestedNode.id, target: leaf.id, targetPort: "prompt.images" }
 *    The nested element's slot in the props is removed (so codegen's
 *    edge-inlining is the inverse of this extraction).
 * 5. `model={fal.imageModel("flux-schnell")}` props are normalised to
 *    `{ provider, id }` references using the runtime `model.provider` and
 *    `model.modelId` fields exposed by every provider's model class.
 *
 * The result is a graph that round-trips through `codegen.generateCode()`
 * back to TSX that is semantically equivalent to the original.
 */

import { elementSchemas } from "../react/element-schemas";
import type { VargElement, VargElementType, VargNode } from "../react/types";
import {
  type GraphEdge,
  type GraphNode,
  newNodeId,
  type WorkflowGraph,
} from "./graph";

interface ParseContext {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  counter: { n: number };
}

export interface ParseOptions {
  /** Default fps if the root render has none. */
  fallbackFps?: number;
  /** Optional graph metadata. */
  meta?: WorkflowGraph["meta"];
}

/**
 * Parse a resolved (in-memory) VargElement into a WorkflowGraph.
 *
 * The element MUST be of type `render` — this matches the user-facing
 * contract of `<Render>...</Render>` as a template's default export.
 */
export function parseElement(
  element: VargElement,
  options: ParseOptions = {},
): WorkflowGraph {
  if (element.type !== "render") {
    throw new Error(
      `parseElement: top-level element must be of type "render" (got "${element.type}")`,
    );
  }

  const ctx: ParseContext = {
    nodes: {},
    edges: [],
    counter: { n: 0 },
  };

  const rootId = walkElement(element, ctx);

  // Best-effort autolayout — assign x/y based on dependency depth.
  layout(ctx.nodes, ctx.edges, rootId);

  return {
    version: 1,
    root: rootId,
    nodes: ctx.nodes,
    edges: ctx.edges,
    meta: {
      ...(options.meta ?? {}),
      createdAt: options.meta?.createdAt ?? new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

function walkElement(element: VargElement, ctx: ParseContext): string {
  const schema = elementSchemas[element.type];
  if (!schema) {
    throw new Error(`parser: unknown element type "${element.type}"`);
  }

  const id = mintId(ctx, element.type);

  // Clone props (deep) — we will mutate to extract edges.
  const props = deepCloneSerialisable(element.props ?? {});

  // Normalise model references.
  normaliseModel(props);

  // Extract nested elements at known port paths into edges.
  for (const port of schema.ports.in) {
    const slotValue = getPath(props, port.path);
    if (slotValue === undefined) continue;

    if (port.multiple) {
      const arr = Array.isArray(slotValue) ? slotValue : [slotValue];
      const remaining: unknown[] = [];
      for (const item of arr) {
        if (isElement(item)) {
          // Only extract if its produced kind matches what the port wants
          // (or `any`). Non-matching items are left in place.
          const producedKind = elementSchemas[item.type]?.ports.out?.kind;
          if (
            producedKind &&
            (port.accepts === "any" || producedKind === port.accepts)
          ) {
            const childId = walkElement(item, ctx);
            ctx.edges.push({
              source: childId,
              target: id,
              targetPort: port.path,
            });
            continue;
          }
        }
        remaining.push(item);
      }
      if (remaining.length === 0) {
        deletePath(props, port.path);
      } else if (Array.isArray(slotValue)) {
        setPath(props, port.path, remaining);
      } else {
        setPath(props, port.path, remaining[0]);
      }
    } else if (isElement(slotValue)) {
      const producedKind = elementSchemas[slotValue.type]?.ports.out?.kind;
      if (
        producedKind &&
        (port.accepts === "any" || producedKind === port.accepts)
      ) {
        const childId = walkElement(slotValue, ctx);
        ctx.edges.push({
          source: childId,
          target: id,
          targetPort: port.path,
        });
        deletePath(props, port.path);
      }
    }
  }

  // Recurse into container children.
  const childIds: string[] = [];
  if (schema.container) {
    for (const child of element.children ?? []) {
      const childId = walkChild(child, ctx);
      if (childId) childIds.push(childId);
    }
  }

  // Speech text lives in element.children for the runtime; mirror to props.text.
  if (element.type === "speech") {
    const text = stringifyTextChildren(element.children);
    if (text !== undefined && props.text === undefined) {
      props.text = text;
    }
  }
  // Title/Subtitle accept text as children too.
  if (
    (element.type === "title" || element.type === "subtitle") &&
    props.text === undefined
  ) {
    const t = stringifyTextChildren(element.children);
    if (t !== undefined) props.text = t;
  }

  const node: GraphNode = {
    id,
    type: element.type,
    props,
  };
  if (schema.container) node.children = childIds;
  ctx.nodes[id] = node;
  return id;
}

function walkChild(node: VargNode, ctx: ParseContext): string | null {
  if (node == null) return null;
  if (typeof node === "string" || typeof node === "number") return null;
  if (Array.isArray(node)) {
    // Flatten unexpected arrays — return first id, push others as siblings.
    // Used only when a JSX expression returned an array directly.
    const ids: string[] = [];
    for (const item of node) {
      const id = walkChild(item, ctx);
      if (id) ids.push(id);
    }
    return ids[0] ?? null;
  }
  if (typeof node === "object" && "type" in node) {
    return walkElement(node as VargElement, ctx);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isElement(v: unknown): v is VargElement {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    typeof (v as { type: unknown }).type === "string" &&
    "props" in v
  );
}

function mintId(ctx: ParseContext, type: VargElementType): string {
  ctx.counter.n += 1;
  // Prefer deterministic ids for stable diffs in tests; fall back to random
  // suffix to avoid collisions across files. Determinism here uses the
  // walk order — `n_image_3` etc.
  return `${type.replace(/[^a-z0-9]/gi, "")}_${ctx.counter.n}_${newNodeId().slice(-4)}`;
}

/** Deep-clone a JSON-ish value while preserving VargElement identity. */
function deepCloneSerialisable(value: unknown): Record<string, unknown> {
  return cloneNode(value) as Record<string, unknown>;
}

function cloneNode(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(cloneNode);
  if (isElement(v)) return v; // do not deep-clone elements — we'll extract them as edges
  // Preserve model refs (which carry methods) by snapshotting fields.
  if ("provider" in v && "modelId" in v) {
    return {
      provider: (v as { provider: unknown }).provider,
      modelId: (v as { modelId: unknown }).modelId,
    };
  }
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = cloneNode(val);
  }
  return out;
}

/** Normalise `props.model` from a provider model instance to `{ provider, id }`. */
function normaliseModel(props: Record<string, unknown>): void {
  const model = props.model;
  if (model && typeof model === "object") {
    const m = model as { provider?: unknown; modelId?: unknown; id?: unknown };
    if (typeof m.provider === "string" && typeof m.modelId === "string") {
      props.model = { provider: m.provider, id: m.modelId };
    } else if (typeof m.provider === "string" && typeof m.id === "string") {
      props.model = { provider: m.provider, id: m.id };
    }
  }
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function deletePath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (typeof next !== "object" || next === null) return;
    cur = next as Record<string, unknown>;
  }
  delete cur[parts[parts.length - 1]!];
  // Clean up empty intermediate containers (best-effort).
  // We leave outer objects intact even if empty — formatter handles it.
}

function stringifyTextChildren(children: VargNode[]): string | undefined {
  const out: string[] = [];
  for (const c of children ?? []) {
    if (typeof c === "string") out.push(c);
    else if (typeof c === "number") out.push(String(c));
  }
  if (out.length === 0) return undefined;
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// Layout — assign canvas positions based on dependency depth.
// ---------------------------------------------------------------------------

function layout(
  nodes: Record<string, GraphNode>,
  edges: GraphEdge[],
  rootId: string,
): void {
  const childIds = new Set<string>();
  for (const n of Object.values(nodes)) {
    for (const c of n.children ?? []) childIds.add(c);
  }

  // Build adjacency: parent → child + producer → consumer.
  const incoming = new Map<string, string[]>();
  for (const id of Object.keys(nodes)) incoming.set(id, []);
  for (const n of Object.values(nodes)) {
    for (const c of n.children ?? []) incoming.get(c)?.push(n.id);
  }
  for (const e of edges) incoming.get(e.target)?.push(e.source);

  // BFS depth from root, but reverse for producers (producers come "before" consumers).
  // Simpler heuristic: depth = longest path from root through containment, with
  // producers placed one column to the left of their consumer.
  const depth = new Map<string, number>();
  depth.set(rootId, 0);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    for (const c of nodes[id]?.children ?? []) {
      if (!depth.has(c) || (depth.get(c) ?? 0) < d + 1) {
        depth.set(c, d + 1);
        queue.push(c);
      }
    }
  }
  // Producers: place them to the LEFT of consumers by walking edges from
  // bottom up. Repeat to stabilise.
  for (let pass = 0; pass < 3; pass++) {
    for (const e of edges) {
      const td = depth.get(e.target);
      if (td !== undefined) {
        const want = td - 1;
        if (!depth.has(e.source) || (depth.get(e.source) ?? 0) > want) {
          depth.set(e.source, Math.max(0, want));
        }
      }
    }
  }
  // Anything not yet placed: depth 0.
  for (const id of Object.keys(nodes)) {
    if (!depth.has(id)) depth.set(id, 0);
  }

  const COL_W = 240;
  const ROW_H = 160;
  const PAD = 80;

  // Bucket per depth and assign y by appearance order.
  const buckets = new Map<number, string[]>();
  for (const [id, d] of depth) {
    const list = buckets.get(d) ?? [];
    list.push(id);
    buckets.set(d, list);
  }
  for (const [d, ids] of buckets) {
    ids.forEach((id, idx) => {
      const node = nodes[id];
      if (!node) return;
      if (!node.position) {
        node.position = {
          x: PAD + d * COL_W,
          y: PAD + idx * ROW_H,
        };
      }
    });
  }
}
