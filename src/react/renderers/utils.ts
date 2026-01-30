import { existsSync, statSync } from "node:fs";
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

function isLocalFilePath(v: string): boolean {
  if (v.startsWith("http://") || v.startsWith("https://")) return false;
  if (v.startsWith("data:")) return false;
  const resolved = resolvePath(v);
  return existsSync(resolved);
}

function getFileFingerprint(path: string): string {
  const resolved = resolvePath(path);
  const stat = statSync(resolved);
  return `${path}:${stat.mtimeMs}:${stat.size}`;
}

const COMMON_IGNORED_PROPS = new Set(["children", "key"]);

const IGNORED_PROPS_BY_TYPE: Partial<Record<VargElement["type"], Set<string>>> =
  {
    image: new Set([
      "left",
      "top",
      "width",
      "height",
      "resize",
      "position",
      "size",
      "zoom",
    ]),
    video: new Set([
      "left",
      "top",
      "width",
      "height",
      "resize",
      "cutFrom",
      "cutTo",
      "volume",
      "keepAudio",
    ]),
    speech: new Set(["volume", "id"]),
  };

function shouldIgnoreProp(
  elementType: VargElement["type"],
  key: string,
): boolean {
  if (COMMON_IGNORED_PROPS.has(key)) return true;
  return IGNORED_PROPS_BY_TYPE[elementType]?.has(key) ?? false;
}

function serializeValue(v: unknown): string {
  if (typeof v === "string") {
    if (isLocalFilePath(v)) {
      return getFileFingerprint(v);
    }
    return v;
  }
  if (v instanceof Uint8Array) {
    return Buffer.from(v).toString("base64");
  }
  if (Array.isArray(v)) {
    return `[${v.map(serializeValue).join(",")}]`;
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v)
      .map(([key, val]) => `${key}:${serializeValue(val)}`)
      .join(",");
    return `{${entries}}`;
  }
  return String(v);
}

export function computeCacheKey(element: VargElement): CacheKeyPart[] {
  const key: CacheKeyPart[] = [element.type];

  for (const [k, v] of Object.entries(element.props)) {
    if (shouldIgnoreProp(element.type, k)) continue;
    if (k === "model" && v && typeof v === "object" && "modelId" in v) {
      const model = v as {
        provider?: string;
        modelId: string;
        settings?: Record<string, unknown>;
      };
      key.push("model", model.provider ?? "", model.modelId);
      // Include model settings in cache key (e.g., higgsfield styleId, quality)
      if (model.settings) {
        key.push("modelSettings", serializeValue(model.settings));
      }
      continue;
    }
    if (typeof v === "string") {
      if (isLocalFilePath(v)) {
        key.push(k, getFileFingerprint(v));
      } else {
        key.push(k, v);
      }
    } else if (typeof v === "number" || typeof v === "boolean") {
      key.push(k, v);
    } else if (v === null || v === undefined) {
      key.push(k, v);
    } else if (v instanceof Uint8Array) {
      key.push(k, Buffer.from(v).toString("base64"));
    } else if (isVargElement(v)) {
      key.push(k, ...computeCacheKey(v));
    } else if (Array.isArray(v) || typeof v === "object") {
      key.push(k, serializeValue(v));
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
