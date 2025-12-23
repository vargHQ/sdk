/**
 * Shared JSON Schema types and utilities for CLI commands
 */

import { z } from "zod";
import type { Definition } from "../core/schema/types";

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
}

/**
 * Get JSON Schema for display - converts Zod schema to JSON Schema
 */
export function getDisplaySchema(item: Definition): {
  input: JsonSchema;
  output: JsonSchema;
} {
  if (!item.inputSchema) {
    return {
      input: { type: "object", properties: {}, required: [] },
      output: { type: "object" },
    };
  }

  const input = z.toJSONSchema(item.inputSchema, { io: "input" }) as JsonSchema;
  const output = item.outputSchema
    ? (z.toJSONSchema(item.outputSchema, { io: "output" }) as JsonSchema)
    : { type: "object" };

  return { input, output };
}
