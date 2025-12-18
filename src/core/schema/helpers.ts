/**
 * Schema helpers for CLI introspection
 * Uses Zod v4's native toJSONSchema() method
 */

import type { JsonSchema, SchemaProperty } from "./types";

/**
 * Convert a Zod schema to JSON Schema format
 * Uses Zod v4's native toJSONSchema() method
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
export function toJsonSchema(schema: any): JsonSchema {
  // Zod v4 has native toJSONSchema() method
  if (typeof schema.toJSONSchema === "function") {
    try {
      return schema.toJSONSchema() as JsonSchema;
    } catch {
      // Some Zod types (transforms, custom) can't be represented in JSON Schema
      // Return a basic schema with description if available
      return {
        type: "object",
        description: schema._def?.description,
      } as JsonSchema;
    }
  }
  // Fallback for older Zod versions or non-Zod schemas
  return schema as JsonSchema;
}

/**
 * Get CLI-friendly schema info for displaying help
 * Returns properties and required fields in JSON Schema format
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
export function getCliSchemaInfo(schema: any): {
  properties: Record<string, SchemaProperty>;
  required: string[];
} {
  const jsonSchema = toJsonSchema(schema);

  return {
    properties: (jsonSchema.properties || {}) as Record<string, SchemaProperty>,
    required: jsonSchema.required || [],
  };
}

/**
 * Generate CLI help text from a Zod schema
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
export function schemaToCliHelp(schema: any): string {
  const { properties, required } = getCliSchemaInfo(schema);
  const lines: string[] = [];

  for (const [key, prop] of Object.entries(properties)) {
    const isRequired = required.includes(key);
    const parts: string[] = [`--${key.padEnd(15)}`];

    if (prop.description) {
      parts.push(prop.description);
    }

    if (isRequired) {
      parts.push("(required)");
    }

    if (prop.default !== undefined) {
      parts.push(`[default: ${JSON.stringify(prop.default)}]`);
    }

    if (prop.enum && prop.enum.length > 0) {
      parts.push(`[${prop.enum.join(", ")}]`);
    }

    lines.push(parts.join(" "));
  }

  return lines.join("\n");
}

/**
 * Coerce a CLI string value to the proper type based on JSON Schema property
 */
export function coerceCliValue(value: string, prop: SchemaProperty): unknown {
  switch (prop.type) {
    case "number":
    case "integer":
      return Number(value);
    case "boolean":
      return value === "true" || value === "1";
    case "array":
      // Handle comma-separated values
      return value.split(",").map((v) => v.trim());
    default:
      return value;
  }
}

/**
 * Parse CLI arguments into an object based on schema
 */
export function parseCliArgs(
  args: string[],
  // biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
  schema: any,
): Record<string, unknown> {
  const { properties } = getCliSchemaInfo(schema);
  const result: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith("--")) continue;

    const key = arg.slice(2);
    const prop = properties[key];

    if (!prop) continue;

    // Boolean flags don't require a value
    if (prop.type === "boolean") {
      result[key] = true;
      continue;
    }

    // Get the value
    const value = args[++i];
    if (value && !value.startsWith("--")) {
      result[key] = coerceCliValue(value, prop);
    }
  }

  return result;
}
