/**
 * Run all async examples and validate their element trees.
 * This imports each example, which triggers top-level await (Speech generation),
 * then inspects the resulting VargElement tree.
 */

import { resolveLazy } from "../../renderers/resolve-lazy";
import { ResolvedElement } from "../../resolved-element";
import type { VargElement, VargNode } from "../../types";

function inspect(label: string, element: VargElement, depth = 0) {
  const indent = "  ".repeat(depth);
  const meta =
    element instanceof ResolvedElement
      ? ` [RESOLVED: duration=${element.duration}s]`
      : "";
  console.log(`${indent}${label}<${element.type}${meta}>`);

  for (const [key, val] of Object.entries(element.props)) {
    if (key === "_promise") continue;
    const valStr =
      val instanceof ResolvedElement
        ? `ResolvedElement<${val.type}> (duration=${val.duration}s)`
        : typeof val === "object" && val !== null
          ? JSON.stringify(val).slice(0, 80)
          : String(val);
    console.log(`${indent}  ${key}=${valStr}`);
  }

  for (const child of element.children) {
    if (child && typeof child === "object" && "type" in child) {
      inspect("", child as VargElement, depth + 1);
    } else if (child instanceof ResolvedElement) {
      console.log(
        `${indent}  {ResolvedElement<${child.type}> duration=${child.duration}s}`,
      );
    }
  }
}

async function runExample(name: string, path: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Example: ${name}`);
  console.log("=".repeat(60));

  try {
    const mod = await import(path);
    let element = mod.default;

    if (typeof element === "function") {
      element = await element();
    }

    // Resolve lazy elements (async components)
    const resolved = (await resolveLazy(element)) as VargElement;

    inspect("", resolved);
    console.log(`\nResult: OK`);
  } catch (err) {
    console.error(`\nResult: FAILED`);
    console.error((err as Error).message);
    console.error((err as Error).stack);
  }
}

// Run all examples
await runExample("simple", "./simple.tsx");
await runExample("simple-with-deps", "./simple-with-deps.tsx");
await runExample("talking-head", "./talking-head.tsx");
await runExample(
  "example_we_want_to_test (strawberry vs chocolate)",
  "./example_we_want_to_test.tsx",
);

console.log(`\n${"=".repeat(60)}`);
console.log("All examples completed.");
