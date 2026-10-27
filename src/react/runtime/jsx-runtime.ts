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
  /**
   * Valid component types. Includes async components
   * (`async function Scene(): Promise<VargElement>`) — the runtime wraps
   * their promise as a `__lazy` element resolved before rendering.
   */
  export type ElementType =
    // biome-ignore lint/suspicious/noExplicitAny: props are validated by each component's own signature
    (props: any) => VargElement | VargNode | Promise<VargElement | VargNode>;
  // biome-ignore lint/complexity/noBannedTypes: required for JSX namespace
  export type IntrinsicElements = {};
  export interface ElementChildrenAttribute {
    // biome-ignore lint/complexity/noBannedTypes: required for JSX namespace
    children: {};
  }
  /** Attributes accepted on every JSX element (the `key` prop). */
  export interface IntrinsicAttributes {
    key?: string | number;
  }
}
