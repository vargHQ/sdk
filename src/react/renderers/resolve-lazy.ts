/**
 * Recursively resolve all "__lazy" elements in a VargNode tree.
 *
 * Lazy elements are created by the JSX runtime when an async component
 * (e.g., `async function Scene()`) is used as a JSX child. The runtime
 * wraps the returned Promise as `{ type: "__lazy", props: { _promise }, children: [] }`.
 *
 * This function awaits all lazy promises and splices the resolved sub-trees
 * back into the parent. Handles Fragments (arrays) and nested lazy elements.
 *
 * Must be called BEFORE renderRoot() so the render pipeline sees a fully
 * static VargElement tree.
 */
import type { VargElement, VargNode } from "../types";

export async function resolveLazy(node: VargNode): Promise<VargNode> {
  // Primitives and nullish values — pass through
  if (node === null || node === undefined) return node;
  if (typeof node === "string" || typeof node === "number") return node;

  // Arrays (from Fragment, or children arrays) — resolve each item
  if (Array.isArray(node)) {
    const resolved = await Promise.all(node.map(resolveLazy));
    // Flatten one level: resolved items might be arrays (from Fragments)
    return resolved.flat();
  }

  // Must be an object — check if it's a VargElement
  if (typeof node !== "object" || !("type" in node)) return node;

  const element = node as VargElement;

  // Lazy element — await the promise and recursively resolve the result
  if (element.type === "__lazy") {
    const promise = (element.props as { _promise: Promise<VargNode> })._promise;
    const resolved = await promise;
    // The resolved value may contain more lazy elements or Fragments
    return resolveLazy(resolved);
  }

  // Regular element — recursively resolve all children
  const resolvedChildren = await Promise.all(
    element.children.map((child) => resolveLazy(child)),
  );

  // Flatten children: a Fragment resolution may produce arrays
  const flatChildren: VargNode[] = [];
  for (const child of resolvedChildren) {
    if (Array.isArray(child)) {
      flatChildren.push(...child);
    } else {
      flatChildren.push(child);
    }
  }

  // Return a new element with resolved children (don't mutate the original).
  // IMPORTANT: strip .then from the spread to prevent Promise.all from
  // treating the result as a thenable (Image/Speech/etc. elements are thenable).
  const result = {
    ...element,
    children: flatChildren,
  };
  if ("then" in result) {
    delete (result as Record<string, unknown>).then;
  }
  return result;
}
