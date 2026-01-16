import { resolve } from "node:path";
import type { VargElement, VargNode } from "../types";

export function resolvePath(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return resolve(process.cwd(), path);
}

export function toFileUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `file://${resolvePath(path)}`;
}

type CacheKeyPart = string | number | boolean | null | undefined;

function isVargElement(v: unknown): v is VargElement {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    "props" in v &&
    "children" in v
  );
}

export function computeCacheKey(element: VargElement): CacheKeyPart[] {
  const key: CacheKeyPart[] = [element.type];

  for (const [k, v] of Object.entries(element.props)) {
    if (k === "children") continue;
    if (k === "model" && v && typeof v === "object" && "modelId" in v) {
      const model = v as { provider?: string; modelId: string };
      key.push("model", model.provider ?? "", model.modelId);
      continue;
    }
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      key.push(k, v);
    } else if (v === null || v === undefined) {
      key.push(k, v);
    } else if (isVargElement(v)) {
      key.push(k, ...computeCacheKey(v));
    } else if (typeof v === "object") {
      key.push(k, JSON.stringify(v));
    }
  }

  for (const child of element.children) {
    if (typeof child === "string") {
      key.push("text", child);
    } else if (typeof child === "number") {
      key.push("num", child);
    } else if (isVargElement(child)) {
      key.push("child", ...computeCacheKey(child));
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
