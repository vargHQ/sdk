/**
 * Input validation using Zod
 * Validates inputs before execution
 */

import type { z } from "zod";

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult<T = unknown> {
  valid: boolean;
  errors: ValidationError[];
  data?: T;
}

/**
 * Validate inputs against a Zod schema
 */
export function validateInputs<T extends z.ZodTypeAny>(
  inputs: unknown,
  schema: T,
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(inputs);

  if (result.success) {
    return {
      valid: true,
      errors: [],
      data: result.data,
    };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      value: inputs,
    })),
  };
}

/**
 * Validate and prepare inputs in one step
 * Zod automatically applies defaults during parsing
 */
export function validateAndPrepare<T extends z.ZodTypeAny>(
  inputs: unknown,
  schema: T,
): ValidationResult<z.infer<T>> {
  return validateInputs(inputs, schema);
}

/**
 * Type-safe validation helper that throws on invalid input
 */
export function parseOrThrow<T extends z.ZodTypeAny>(
  inputs: unknown,
  schema: T,
): z.infer<T> {
  return schema.parse(inputs);
}

/**
 * Apply defaults to inputs using Zod schema
 * Zod automatically applies defaults during parsing
 * Returns the input with defaults applied
 */
export function applyDefaults(
  inputs: unknown,
  // biome-ignore lint/suspicious/noExplicitAny: Zod v4 type compatibility
  schema: any,
): Record<string, unknown> {
  // If schema has .input property (ZodSchema interface), use that
  const zodSchema = schema.input || schema;

  // Parse with defaults - if invalid, return inputs as-is
  try {
    return zodSchema.parse(inputs);
  } catch {
    // If validation fails, try to apply partial defaults
    const partial = zodSchema.partial().safeParse(inputs);
    if (partial.success) {
      return { ...(inputs as Record<string, unknown>), ...partial.data };
    }
    return inputs as Record<string, unknown>;
  }
}
