/**
 * CLI utilities
 */

import { z } from "zod";
import type { Definition } from "../core/schema/types";
import type { JsonSchema, NotFoundOptions } from "./types";

/**
 * Handle "not found" errors consistently
 */
export function handleNotFound(
  name: string,
  options: NotFoundOptions = {},
): never | undefined {
  const {
    suggestions = [],
    maxSuggestions = 3,
    hint = "run `varg list` to see available items",
    errorColorFn = (s) => s,
    hintColorFn = (s) => s,
    exit = true,
  } = options;

  console.error(`\n  ${errorColorFn("not found:")} '${name}'\n`);

  if (suggestions.length > 0) {
    const shown = suggestions.slice(0, maxSuggestions).join(", ");
    console.log(`  did you mean: ${shown}?\n`);
  }

  if (hint) {
    console.log(`  ${hintColorFn(hint)}\n`);
  }

  if (exit) {
    process.exit(1);
  }
}

/**
 * Convert a definition to a table row object
 */
export const definitionToRow = (d: Definition) => ({
  name: d.name,
  description: d.description,
  type: d.type,
});

/**
 * Convert an array of definitions to table rows
 */
export const definitionsToRows = (defs: Definition[]) =>
  defs.map(definitionToRow);

/**
 * Get JSON Schema for display - converts Zod schema to JSON Schema
 */
export function getDisplaySchema(item: Definition): {
  input: JsonSchema;
  output: JsonSchema;
} {
  if (!item.schema) {
    return {
      input: { type: "object", properties: {}, required: [] },
      output: { type: "object" },
    };
  }

  const input = z.toJSONSchema(item.schema.input, {
    io: "input",
  }) as JsonSchema;
  const output = item.schema.output
    ? (z.toJSONSchema(item.schema.output, { io: "output" }) as JsonSchema)
    : { type: "object" };

  return { input, output };
}
