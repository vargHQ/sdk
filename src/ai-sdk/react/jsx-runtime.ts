import type { VargElement, VargNode } from "./types";

type ElementFactory = (props: Record<string, unknown>) => VargElement;

export function jsx(
  type: ElementFactory,
  props: Record<string, unknown> | null,
  key?: string,
): VargElement {
  const finalProps = { ...props };
  if (key !== undefined) {
    finalProps.key = key;
  }
  return type(finalProps);
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
