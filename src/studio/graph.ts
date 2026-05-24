/**
 * Workflow graph — the JSON document that backs the visual studio canvas.
 *
 * A `WorkflowGraph` is a directed acyclic graph of `GraphNode`s. Each node
 * corresponds 1:1 to a `VargElement` of the same `type` (see
 * `react/element-schemas.ts`). Two relationships exist between nodes:
 *
 *   - **Containment** — encoded in `GraphNode.children[]`. Used by container
 *     elements (`render`, `clip`, `overlay`, `split`, `slider`, `swipe`).
 *     A child id appears in `nodes` exactly once and is referenced as a child
 *     of exactly one parent.
 *
 *   - **Data-flow** — encoded in top-level `edges[]`. An edge says: when
 *     codegen renders `target`, inline the JSX expression for `source` at
 *     the dotted prop path `targetPort`. Ports are declared by
 *     `element-schemas.ts::elementSchemas[t].ports.in`. A node that is only
 *     referenced as the source of a data-flow edge (and never as a child)
 *     is a "producer": it is not rendered standalone — it is inlined where
 *     it is consumed.
 *
 * Persistence
 * -----------
 * Stored on disk next to the TSX as `<name>.varg.json`. The TSX file remains
 * the canonical executable; the graph is a friendly representation for the
 * visual editor (positions, ids) plus a round-trip target.
 */

import { z } from "zod";
import {
  elementSchemas,
  getInPort,
  type MediaKind,
} from "../react/element-schemas";
import type { VargElementType } from "../react/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  /** Stable id (nanoid-style). Used as drawflow node id and as edge endpoints. */
  id: string;
  /** Element type — must be a key of `elementSchemas`. */
  type: VargElementType;
  /** Static / serialisable props validated by `elementSchemas[type].props`. */
  props: Record<string, unknown>;
  /** Ordered child node ids (only meaningful for container elements). */
  children?: string[];
  /** Canvas position. Optional — autolayout will fill missing values. */
  position?: { x: number; y: number };
}

export interface GraphEdge {
  /** Producer node id. */
  source: string;
  /** Consumer node id. */
  target: string;
  /**
   * Dotted prop path on `target` where `source` is inlined.
   * Must match an entry in `elementSchemas[target.type].ports.in[*].path`.
   *
   * Array-typed ports (e.g. `prompt.images`) may be repeated across multiple
   * edges; their order is the order edges appear in `edges[]` (filtered for
   * the same target+path).
   */
  targetPort: string;
}

export interface WorkflowGraph {
  version: 1;
  /** Id of the root node — must be a `render` element. */
  root: string;
  /** All nodes in the graph, keyed by id. */
  nodes: Record<string, GraphNode>;
  /** Data-flow edges (producer → consumer prop slot). */
  edges: GraphEdge[];
  meta?: {
    name?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------

const graphNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
    children: z.array(z.string()).optional(),
    position: z.object({ x: z.number(), y: z.number() }).strict().optional(),
  })
  .strict();

const graphEdgeSchema = z
  .object({
    source: z.string().min(1),
    target: z.string().min(1),
    targetPort: z.string().min(1),
  })
  .strict();

export const workflowGraphSchema = z
  .object({
    version: z.literal(1),
    root: z.string().min(1),
    nodes: z.record(z.string(), graphNodeSchema),
    edges: z.array(graphEdgeSchema).default([]),
    meta: z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  /** Node or edge identifier. */
  where: string;
  message: string;
}

/**
 * Validates a `WorkflowGraph` beyond shape:
 *   - root exists and is a render element
 *   - every child id exists; no duplicate parents; no cycles
 *   - every edge endpoint exists; targetPort is a declared in-port of target
 *   - producer kind is compatible with port `accepts`
 *   - per-element props validate against `elementSchemas[type].props`
 *
 * Returns an array of issues. Empty array == valid.
 */
export function validateGraph(graph: WorkflowGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const root = graph.nodes[graph.root];
  if (!root) {
    issues.push({ where: graph.root, message: "root node id is not in nodes" });
    return issues;
  }
  if (root.type !== "render") {
    issues.push({
      where: graph.root,
      message: `root node must be of type "render" (got "${root.type}")`,
    });
  }

  // Validate per-node prop shapes + that the element type is known.
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.id !== id) {
      issues.push({
        where: id,
        message: `node.id "${node.id}" does not match key "${id}"`,
      });
    }
    const schema = elementSchemas[node.type as VargElementType];
    if (!schema) {
      issues.push({
        where: id,
        message: `unknown element type "${node.type}"`,
      });
      continue;
    }
    const result = schema.props.safeParse(node.props);
    if (!result.success) {
      const first = result.error.issues[0];
      issues.push({
        where: id,
        message:
          `invalid props: ${first?.path.join(".") ?? ""} ${first?.message ?? ""}`.trim(),
      });
    }
  }

  // Containment: child ids must exist; each id has at most one parent; no cycles.
  const parents = new Map<string, string>();
  for (const [parentId, node] of Object.entries(graph.nodes)) {
    for (const childId of node.children ?? []) {
      if (!graph.nodes[childId]) {
        issues.push({
          where: parentId,
          message: `child "${childId}" not found in nodes`,
        });
        continue;
      }
      if (parents.has(childId)) {
        issues.push({
          where: childId,
          message: `child has multiple parents (${parents.get(childId)} and ${parentId})`,
        });
      } else {
        parents.set(childId, parentId);
      }
    }
  }

  // Edge validation.
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i];
    if (!edge) continue;
    const where = `edge[${i}]`;
    const source = graph.nodes[edge.source];
    const target = graph.nodes[edge.target];
    if (!source) {
      issues.push({ where, message: `source "${edge.source}" not found` });
      continue;
    }
    if (!target) {
      issues.push({ where, message: `target "${edge.target}" not found` });
      continue;
    }
    const port = getInPort(target.type, edge.targetPort);
    if (!port) {
      issues.push({
        where,
        message: `target "${edge.target}" has no in-port "${edge.targetPort}"`,
      });
      continue;
    }
    const producerKind = elementSchemas[source.type]?.ports.out?.kind;
    if (!producerKind) {
      issues.push({
        where,
        message: `source "${edge.source}" (${source.type}) produces no output`,
      });
      continue;
    }
    if (!isCompatible(producerKind, port.accepts)) {
      issues.push({
        where,
        message: `kind mismatch: source produces ${producerKind}, port accepts ${port.accepts}`,
      });
    }
  }

  // Cycle check via DFS over children + edges (both form dependencies).
  if (issues.length === 0 && hasCycle(graph)) {
    issues.push({ where: "graph", message: "cycle detected" });
  }

  return issues;
}

function isCompatible(produced: MediaKind, accepted: MediaKind): boolean {
  if (accepted === "any") return true;
  if (produced === "any") return true;
  return produced === accepted;
}

function hasCycle(graph: WorkflowGraph): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of Object.keys(graph.nodes)) color.set(id, WHITE);

  // Outgoing deps: own children + nodes whose edges target this node's
  // children? No — for cycle purposes we treat both child links and
  // data-flow edges (source → target) as dependencies.
  const out = new Map<string, Set<string>>();
  for (const [id, node] of Object.entries(graph.nodes)) {
    const set = new Set<string>();
    for (const c of node.children ?? []) set.add(c);
    out.set(id, set);
  }
  for (const e of graph.edges) {
    // source must finish (be rendered) before target can reference it.
    // Cycle = target → source → ... → target.
    out.get(e.target)?.add(e.source);
  }

  function dfs(id: string): boolean {
    color.set(id, GRAY);
    for (const next of out.get(id) ?? []) {
      const c = color.get(next);
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  }

  for (const id of Object.keys(graph.nodes)) {
    if (color.get(id) === WHITE && dfs(id)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a short random id. Avoids a nanoid dependency. */
export function newNodeId(prefix = "n"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/** Returns a list of producer-only nodes (no parent and only referenced via edges). */
export function findProducers(graph: WorkflowGraph): string[] {
  const childIds = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    for (const c of node.children ?? []) childIds.add(c);
  }
  return Object.keys(graph.nodes).filter(
    (id) => id !== graph.root && !childIds.has(id),
  );
}

/**
 * Returns edges grouped by `target`, in declaration order.
 * Each target's entries are ordered (used by codegen for array ports).
 */
export function edgesByTarget(graph: WorkflowGraph): Map<string, GraphEdge[]> {
  const out = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    const list = out.get(e.target) ?? [];
    list.push(e);
    out.set(e.target, list);
  }
  return out;
}

/** Creates an empty graph with a single Render root. */
export function emptyGraph(opts?: {
  width?: number;
  height?: number;
  fps?: number;
  name?: string;
}): WorkflowGraph {
  const rootId = newNodeId("render");
  return {
    version: 1,
    root: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        type: "render",
        props: {
          width: opts?.width ?? 1080,
          height: opts?.height ?? 1920,
          fps: opts?.fps ?? 30,
        },
        children: [],
        position: { x: 80, y: 80 },
      },
    },
    edges: [],
    meta: {
      name: opts?.name,
      createdAt: new Date().toISOString(),
    },
  };
}
