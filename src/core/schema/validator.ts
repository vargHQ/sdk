/**
 * Input validation using Zod schemas
 */

import { z } from "zod";
import type { Definition } from "./types";

export interface ZodValidationResult<T = unknown> {
  success: true;
  data: T;
}

export interface ZodValidationError {
  success: false;
  error: z.ZodError;
}

export type ZodResult<T = unknown> = ZodValidationResult<T> | ZodValidationError;

/**
 * Validate inputs using a Zod schema
 */
export function validateWithZod<T extends z.ZodType>(
  schema: T,
  data: unknown,
): ZodResult<z.infer<T>> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod errors for display
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Validate inputs for a definition
 */
export function validateDefinitionInputs(
  definition: Definition,
  inputs: Record<string, unknown>,
): {
  valid: boolean;
  errors: string[];
  inputs: Record<string, unknown>;
} {
  if (!definition.inputSchema) {
    // No schema defined, pass through
    return { valid: true, errors: [], inputs };
  }

  const result = validateWithZod(definition.inputSchema, inputs);
  if (result.success) {
    return { valid: true, errors: [], inputs: result.data as Record<string, unknown> };
  }

  return {
    valid: false,
    errors: formatZodErrors(result.error),
    inputs,
  };
}
