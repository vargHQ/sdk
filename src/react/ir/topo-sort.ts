import type { Step } from "./types";

/**
 * Sort steps topologically: dependencies before dependents.
 * Stable for independent steps (preserves discovery order).
 *
 * Uses Kahn's algorithm (iterative, no recursion) to avoid stack
 * overflow on large plans.
 *
 * @throws Error on circular dependencies.
 */
export function topoSort(steps: Step[]): Step[] {
  // Build in-degree map and dependents adjacency list.
  const inDegree = new Map<Step, number>();
  const dependents = new Map<Step, Step[]>();

  for (const step of steps) {
    inDegree.set(step, 0);
    dependents.set(step, []);
  }
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      inDegree.set(step, (inDegree.get(step) ?? 0) + 1);
      dependents.get(dep)?.push(step);
    }
  }

  // Seed the queue with all zero-in-degree steps, preserving discovery order.
  const queue: Step[] = steps.filter((s) => (inDegree.get(s) ?? 0) === 0);
  const result: Step[] = [];

  while (queue.length > 0) {
    const step = queue.shift()!;
    result.push(step);
    for (const dependent of dependents.get(step) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (result.length !== steps.length) {
    // Remaining steps have cyclic dependencies.
    const cyclic = steps.filter((s) => !result.includes(s));
    const ids = cyclic.map((s) => s.id).join(", ");
    throw new Error(`Circular dependency detected among steps: ${ids}`);
  }

  return result;
}
