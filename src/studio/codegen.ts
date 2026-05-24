/**
 * Graph → TSX printer.
 *
 * Emits a self-contained TypeScript module from a `WorkflowGraph`:
 *
 *   import { fal } from "vargai/ai";
 *   import { Clip, Image, Render, Video } from "vargai/react";
 *
 *   export default (
 *     <Render width={1080} height={1920}>
 *       <Clip duration={5}>
 *         <Video prompt={...} model={fal.videoModel("kling-v2.5")} />
 *       </Clip>
 *     </Render>
 *   );
 *
 * Data-flow edges are realised by inlining the producer's JSX expression
 * at the consumer's prop slot. Producer nodes that are referenced by an
 * edge are NOT emitted as top-level JSX children; they only appear inline.
 *
 * The output is intentionally syntactically conservative and matches the
 * formatting style of `src/react/examples/*.tsx`.
 */

import { elementSchemas, getInPort } from "../react/element-schemas";
import type { VargElementType } from "../react/types";
import {
  edgesByTarget,
  type GraphEdge,
  type GraphNode,
  type WorkflowGraph,
} from "./graph";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CodegenOptions {
  /** Indent unit. Default two spaces. */
  indent?: string;
  /** Emit a header comment (default true). */
  header?: boolean;
}

export interface CodegenResult {
  code: string;
  /** Element factory names that were imported from "vargai/react". */
  reactImports: string[];
  /** Provider names imported from "vargai/ai" (e.g. "fal", "elevenlabs"). */
  providerImports: string[];
}

export function generateCode(
  graph: WorkflowGraph,
  options: CodegenOptions = {},
): CodegenResult {
  const indent = options.indent ?? "  ";
  const header = options.header !== false;

  // Sets accumulated while walking the graph; consumed when assembling imports.
  const reactImports = new Set<string>();
  const providerImports = new Set<string>();

  // Nodes referenced as the source of any edge are inlined and must not be
  // emitted again as a standalone child. We also track "consumed as child"
  // separately so we don't emit a node twice.
  const inlinedAsProducer = new Set<string>();
  for (const e of graph.edges) inlinedAsProducer.add(e.source);

  const edgesByTgt = edgesByTarget(graph);

  function renderElement(
    nodeId: string,
    depth: number,
    asExpression: boolean,
  ): string {
    const node = graph.nodes[nodeId];
    if (!node) return "";
    const factory = elementFactoryName(node.type);
    reactImports.add(factory);

    const ind = indent.repeat(depth);

    // Merge props: schema-known props + edge inlines.
    const incoming = edgesByTgt.get(nodeId) ?? [];
    const inlinedProps = buildInlinedProps(node, incoming, depth + 1);
    const propParts = buildPropParts(
      node,
      inlinedProps,
      depth + 1,
      providerImports,
    );

    // Container vs leaf
    const childIds = node.children ?? [];
    const renderableChildren = childIds.filter(
      (id) => !inlinedAsProducer.has(id) && graph.nodes[id],
    );

    if (asExpression) {
      // Used when the element is inlined as a prop expression (no parent JSX).
      // Always prefer factory-call form: Image({...}) — matches the existing
      // examples (`character-video.tsx`, `madi.tsx`).
      return emitFactoryCall(factory, propParts, depth);
    }

    if (renderableChildren.length === 0) {
      // Self-closing JSX leaf.
      if (propParts.length === 0) return `${ind}<${factory} />`;
      if (propParts.length === 1) return `${ind}<${factory} ${propParts[0]} />`;
      return [
        `${ind}<${factory}`,
        ...propParts.map((p) => `${ind}${indent}${p}`),
        `${ind}/>`,
      ].join("\n");
    }

    // JSX with children.
    const open =
      propParts.length === 0
        ? `${ind}<${factory}>`
        : propParts.length === 1
          ? `${ind}<${factory} ${propParts[0]}>`
          : [
              `${ind}<${factory}`,
              ...propParts.map((p) => `${ind}${indent}${p}`),
              `${ind}>`,
            ].join("\n");

    const childLines = renderableChildren
      .map((id) => renderElement(id, depth + 1, false))
      .filter(Boolean)
      .join("\n");

    return `${open}\n${childLines}\n${ind}</${factory}>`;
  }

  /**
   * Build a partial props object containing the inlined producer expressions
   * for every edge pointing at this node. Returns a plain object whose values
   * are pre-formatted code strings, wrapped in a sentinel marker so the
   * downstream printer can distinguish them from data props.
   */
  function buildInlinedProps(
    node: GraphNode,
    incoming: GraphEdge[],
    depth: number,
  ): Map<string, CodeExpr | CodeExpr[]> {
    const out = new Map<string, CodeExpr | CodeExpr[]>();

    for (const edge of incoming) {
      const port = getInPort(node.type, edge.targetPort);
      if (!port) continue; // ignore unknown ports — caught by validateGraph
      const code = renderElement(edge.source, depth, /*asExpression*/ true);
      const expr: CodeExpr = { __code: code };
      if (port.multiple) {
        const existing = (out.get(port.path) as CodeExpr[] | undefined) ?? [];
        existing.push(expr);
        out.set(port.path, existing);
      } else {
        out.set(port.path, expr);
      }
    }
    return out;
  }

  // ---- top of file ----
  const rootCode = renderElement(graph.root, 1, false);

  const reactList = [...reactImports].sort();
  const providerList = [...providerImports].sort();

  const importLines: string[] = [];
  if (providerList.length > 0) {
    importLines.push(`import { ${providerList.join(", ")} } from "vargai/ai";`);
  }
  if (reactList.length > 0) {
    importLines.push(`import { ${reactList.join(", ")} } from "vargai/react";`);
  }

  const headerComment = header
    ? `// Generated by varg studio — edit the canvas, not this file.\n// Round-trips via studio/parser.ts.\n\n`
    : "";

  const code = `${headerComment}${importLines.join("\n")}${
    importLines.length ? "\n\n" : ""
  }export default (\n${rootCode}\n);\n`;

  return {
    code,
    reactImports: reactList,
    providerImports: providerList,
  };
}

// ---------------------------------------------------------------------------
// Prop printing
// ---------------------------------------------------------------------------

/** Marker type used to thread already-formatted code through the prop printer. */
type CodeExpr = { __code: string };
function isCodeExpr(v: unknown): v is CodeExpr {
  return (
    typeof v === "object" &&
    v !== null &&
    "__code" in v &&
    typeof (v as { __code: unknown }).__code === "string"
  );
}

function buildPropParts(
  node: GraphNode,
  inlines: Map<string, CodeExpr | CodeExpr[]>,
  depth: number,
  providerImports: Set<string>,
): string[] {
  // Deep clone so edge inlining never mutates the source graph.
  const merged: Record<string, unknown> = deepCloneProps(node.props);

  // Apply inlined edges into the merged props at their dotted paths.
  for (const [path, val] of inlines) setPath(merged, path, val);

  // `model` is treated specially — emit as `provider.kindModel("id")`.
  if (
    merged.model &&
    typeof merged.model === "object" &&
    !isCodeExpr(merged.model)
  ) {
    const m = merged.model as { provider?: string; id?: string };
    if (m.provider && m.id) {
      providerImports.add(m.provider);
      const kind = modelKindForElement(node.type);
      merged.model = { __code: `${m.provider}.${kind}("${m.id}")` };
    }
  }

  // Sort keys deterministically — primitives first, then objects, then arrays,
  // then children. For now: keep insertion order then alphabetize objects.
  const entries = Object.entries(merged);

  const parts: string[] = [];
  for (const [k, v] of entries) {
    const formatted = formatPropValue(v, depth + 1);
    if (formatted === undefined) continue;
    if (formatted.includes("\n")) {
      parts.push(`${k}={${formatted}}`);
    } else if (typeof v === "string") {
      // Already includes its own quoting.
      parts.push(`${k}=${formatted}`);
    } else if (typeof v === "boolean" && v === true) {
      parts.push(k); // shorthand
    } else {
      parts.push(`${k}={${formatted}}`);
    }
  }
  return parts;
}

/**
 * Formats a JS value as a TSX prop value. Returns `undefined` to skip
 * (used for `undefined`, `null`, empty arrays/objects).
 *
 * String values include their outer quotes (so we can use `attr="..."` form
 * rather than `attr={"..."}`).
 */
function formatPropValue(v: unknown, depth: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (isCodeExpr(v)) return v.__code;
  if (typeof v === "string") {
    return JSON.stringify(v);
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return undefined;
    const items = v
      .map((item) => formatExpression(item, depth + 1))
      .filter((s): s is string => s !== undefined);
    // Single-line when all items are short.
    const oneLine = `[${items.join(", ")}]`;
    if (oneLine.length <= 80 && !oneLine.includes("\n")) return oneLine;
    const ind = "  ".repeat(depth);
    const close = "  ".repeat(depth - 1);
    return `[\n${items.map((it) => `${ind}${it},`).join("\n")}\n${close}]`;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const entries = Object.entries(obj).filter(
      ([, val]) => val !== undefined && val !== null,
    );
    if (entries.length === 0) return undefined;
    const pieces: string[] = [];
    for (const [k, val] of entries) {
      const piece = formatExpression(val, depth + 1);
      if (piece === undefined) continue;
      pieces.push(`${k}: ${piece}`);
    }
    const oneLine = `{ ${pieces.join(", ")} }`;
    if (oneLine.length <= 60 && !oneLine.includes("\n")) return oneLine;
    const ind = "  ".repeat(depth);
    const close = "  ".repeat(depth - 1);
    return `{\n${pieces.map((p) => `${ind}${p},`).join("\n")}\n${close}}`;
  }
  return undefined;
}

/** Like `formatPropValue` but always returns an expression (never includes `attr=`). */
function formatExpression(v: unknown, depth: number): string | undefined {
  if (isCodeExpr(v)) return v.__code;
  if (typeof v === "string") return JSON.stringify(v);
  return formatPropValue(v, depth);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elementFactoryName(type: VargElementType): string {
  switch (type) {
    case "talking-head":
      return "TalkingHead";
    case "ffmpeg":
      return "FFmpeg";
    default:
      return capitalize(type);
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function modelKindForElement(type: VargElementType): string {
  switch (type) {
    case "image":
      return "imageModel";
    case "video":
    case "talking-head":
      return "videoModel";
    case "speech":
      return "speechModel";
    case "music":
      return "musicModel";
    default:
      return "model";
  }
}

/**
 * Emits a factory-call expression: `Image({ prompt: "...", model: fal.imageModel("flux") })`.
 */
function emitFactoryCall(
  factory: string,
  propParts: string[],
  depth: number,
): string {
  // Strip the leading `attr=` from each part to convert to object syntax.
  // `prompt="x"` → `prompt: "x"`; `model={fal.x()}` → `model: fal.x()`;
  // shorthand boolean `keepAudio` → `keepAudio: true`.
  const objectEntries = propParts.map((p) => {
    if (!p.includes("=")) return `${p}: true`;
    const eq = p.indexOf("=");
    const key = p.slice(0, eq);
    let val = p.slice(eq + 1);
    if (val.startsWith("{") && val.endsWith("}")) val = val.slice(1, -1);
    return `${key}: ${val}`;
  });

  const oneLine = `${factory}({ ${objectEntries.join(", ")} })`;
  if (oneLine.length <= 80 && !oneLine.includes("\n")) return oneLine;
  const ind = "  ".repeat(depth + 1);
  const close = "  ".repeat(depth);
  return `${factory}({\n${objectEntries
    .map((e) => `${ind}${e},`)
    .join("\n")}\n${close}})`;
}

/**
 * Deep clone a plain-object props bag so codegen never mutates the source graph.
 * Code-expr markers and primitives are passed through; arrays are recreated.
 */
function deepCloneProps(value: unknown): Record<string, unknown> {
  return cloneAny(value) as Record<string, unknown>;
}

function cloneAny(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v !== "object") return v;
  if (isCodeExpr(v)) return v;
  if (Array.isArray(v)) return v.map(cloneAny);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = cloneAny(val);
  }
  return out;
}

/** Set a value at a dotted path, creating intermediate plain objects. */
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
