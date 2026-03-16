import type { VargElement, VargNode } from "../types";

type ElementFactory = (
  props: Record<string, unknown>,
) => VargElement | Promise<VargNode>;

export function jsx(
  type: ElementFactory,
  props: Record<string, unknown> | null,
  key?: string,
): VargElement {
  const finalProps = { ...props };
  if (key !== undefined) {
    finalProps.key = key;
  }
  const result = type(finalProps);

  // Async component (e.g., `async function Scene()`) returns a Promise.
  // Wrap it as a "__lazy" element to be resolved before rendering.
  //
  // IMPORTANT: Thenable VargElements (e.g., from `Speech()`) have both
  // `.then` AND `.type` — those are NOT lazy elements, they are regular
  // elements that happen to be awaitable. We only wrap pure Promises
  // (no `.type` property) as lazy.
  if (
    result &&
    typeof result === "object" &&
    typeof (result as PromiseLike<unknown>).then === "function" &&
    !("type" in result && typeof (result as VargElement).type === "string")
  ) {
    return {
      type: "__lazy",
      props: { _promise: result },
      children: [],
    } as VargElement<"__lazy">;
  }

  return result as VargElement;
}

export function jsxs(
  type: ElementFactory,
  props: Record<string, unknown> | null,
  key?: string,
): VargElement {
  return jsx(type, props, key);
}

export const Fragment = ({ children }: { children?: VargNode }) => children;

export namespace JSX {
  export type Element = VargElement;
  // biome-ignore lint/complexity/noBannedTypes: required for JSX namespace
  export type IntrinsicElements = {};
  export interface ElementChildrenAttribute {
    // biome-ignore lint/complexity/noBannedTypes: required for JSX namespace
    children: {};
  }
}
