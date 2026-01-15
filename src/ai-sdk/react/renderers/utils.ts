import type { VargElement, VargNode } from "../types";

export function computeCacheKey(
  element: VargElement,
): (string | number | boolean | null | undefined)[] {
  const key: (string | number | boolean | null | undefined)[] = [element.type];

  for (const [k, v] of Object.entries(element.props)) {
    if (k === "model" || k === "children") continue;
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      key.push(k, v);
    } else if (v === null || v === undefined) {
      key.push(k, v);
    }
  }

  for (const child of element.children) {
    if (typeof child === "string") {
      key.push("text", child);
    } else if (typeof child === "number") {
      key.push("num", child);
    }
  }

  return key;
}

export function getTextContent(node: VargNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node && typeof node === "object" && "children" in node) {
    return node.children.map(getTextContent).join("");
  }
  return "";
}
