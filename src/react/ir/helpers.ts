import { ResolvedElement } from "../resolved-element";
import type { VargElement } from "../types";

/** Type guard: is this value a VargElement? */
export function isVargElement(v: unknown): v is VargElement {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    "props" in v &&
    "children" in v
  );
}

/** Has this element already been resolved (await'd or cached)? */
export function isPreResolved(element: VargElement): boolean {
  return element instanceof ResolvedElement || element.meta?.file != null;
}

/** Truncate a string to n chars with ellipsis. */
export function truncate(s: string, n = 30): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

/** Build a human-readable label for a step from the element's prompt/src/text. */
export function getLabel(element: VargElement): string {
  const props = element.props;
  const prompt = props.prompt;
  if (typeof prompt === "string") return `${element.type}: ${truncate(prompt)}`;
  if (prompt && typeof prompt === "object" && "text" in prompt) {
    const text = (prompt as { text?: string }).text;
    if (text) return `${element.type}: ${truncate(text)}`;
  }
  if (typeof props.src === "string")
    return `${element.type}: ${String(props.src).split("/").pop()}`;
  const text = element.children
    .filter((c): c is string => typeof c === "string")
    .join(" ");
  if (text) return `${element.type}: ${truncate(text)}`;
  return element.type;
}
