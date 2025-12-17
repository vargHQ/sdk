/**
 * Input validation against schemas
 * Validates inputs before execution
 */

import type { Schema, SchemaProperty } from "./types";

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate inputs against a schema
 */
export function validateInputs(
  inputs: Record<string, unknown>,
  schema: Schema,
): ValidationResult {
  const errors: ValidationError[] = [];
  const { required = [], properties = {} } = schema.input;

  // Check required fields
  for (const field of required) {
    if (!(field in inputs) || inputs[field] === undefined) {
      errors.push({
        path: field,
        message: `Required field "${field}" is missing`,
      });
    }
  }

  // Validate each provided field
  for (const [key, value] of Object.entries(inputs)) {
    const prop = properties[key];
    if (!prop) {
      // Unknown field - could warn but not an error
      continue;
    }

    const fieldErrors = validateProperty(key, value, prop);
    errors.push(...fieldErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single property value
 */
function validateProperty(
  path: string,
  value: unknown,
  prop: SchemaProperty,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Null/undefined check (unless it has a default)
  if (value === null || value === undefined) {
    if (prop.default === undefined) {
      errors.push({
        path,
        message: `Value for "${path}" cannot be null or undefined`,
        value,
      });
    }
    return errors;
  }

  // Type validation
  const actualType = getType(value);
  const expectedType = prop.type;

  if (!isTypeMatch(actualType, expectedType)) {
    errors.push({
      path,
      message: `Expected ${expectedType} for "${path}", got ${actualType}`,
      value,
    });
    return errors; // Don't continue validation if type is wrong
  }

  // Enum validation
  if (prop.enum && !prop.enum.includes(value as string | number)) {
    errors.push({
      path,
      message: `Value for "${path}" must be one of: ${prop.enum.join(", ")}`,
      value,
    });
  }

  // Format validation
  if (prop.format) {
    const formatError = validateFormat(path, value, prop.format);
    if (formatError) {
      errors.push(formatError);
    }
  }

  // Array validation
  if (prop.type === "array" && Array.isArray(value) && prop.items) {
    for (let i = 0; i < value.length; i++) {
      const itemErrors = validateProperty(
        `${path}[${i}]`,
        value[i],
        prop.items,
      );
      errors.push(...itemErrors);
    }
  }

  // Object validation
  if (prop.type === "object" && typeof value === "object" && prop.properties) {
    const obj = value as Record<string, unknown>;

    // Check required fields in nested object
    if (prop.required) {
      for (const field of prop.required) {
        if (!(field in obj)) {
          errors.push({
            path: `${path}.${field}`,
            message: `Required field "${path}.${field}" is missing`,
          });
        }
      }
    }

    // Validate nested properties
    for (const [key, val] of Object.entries(obj)) {
      const nestedProp = prop.properties[key];
      if (nestedProp) {
        const nestedErrors = validateProperty(
          `${path}.${key}`,
          val,
          nestedProp,
        );
        errors.push(...nestedErrors);
      }
    }
  }

  return errors;
}

/**
 * Get the type of a value
 */
function getType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value;
}

/**
 * Check if actual type matches expected type
 */
function isTypeMatch(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  // integer is a valid number
  if (expected === "number" && actual === "integer") return true;
  // number can be accepted as integer if it's whole
  if (expected === "integer" && actual === "number") return false;
  return false;
}

/**
 * Validate format-specific constraints
 */
function validateFormat(
  path: string,
  value: unknown,
  format: string,
): ValidationError | null {
  switch (format) {
    case "file-path": {
      if (typeof value !== "string") {
        return {
          path,
          message: `Value for "${path}" must be a string (file path)`,
          value,
        };
      }
      // Basic path validation - must not be empty
      if (value.trim() === "") {
        return {
          path,
          message: `File path for "${path}" cannot be empty`,
          value,
        };
      }
      break;
    }

    case "url": {
      if (typeof value !== "string") {
        return {
          path,
          message: `Value for "${path}" must be a string (URL)`,
          value,
        };
      }
      try {
        new URL(value);
      } catch {
        return {
          path,
          message: `Invalid URL for "${path}"`,
          value,
        };
      }
      break;
    }

    case "uri": {
      if (typeof value !== "string") {
        return {
          path,
          message: `Value for "${path}" must be a string (URI)`,
          value,
        };
      }
      // URI can be URL or file path
      if (
        !value.startsWith("http://") &&
        !value.startsWith("https://") &&
        !value.startsWith("file://") &&
        !value.startsWith("/") &&
        !value.match(/^[a-zA-Z]:\\/)
      ) {
        return {
          path,
          message: `Invalid URI for "${path}" - must be a URL or absolute path`,
          value,
        };
      }
      break;
    }

    case "email": {
      if (typeof value !== "string" || !value.includes("@")) {
        return {
          path,
          message: `Invalid email format for "${path}"`,
          value,
        };
      }
      break;
    }

    case "date":
    case "date-time": {
      if (typeof value !== "string") {
        return {
          path,
          message: `Value for "${path}" must be a string (date)`,
          value,
        };
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return {
          path,
          message: `Invalid date format for "${path}"`,
          value,
        };
      }
      break;
    }

    case "duration": {
      if (typeof value !== "number" || value < 0) {
        return {
          path,
          message: `Duration for "${path}" must be a non-negative number`,
          value,
        };
      }
      break;
    }
  }

  return null;
}

/**
 * Apply default values to inputs
 */
export function applyDefaults(
  inputs: Record<string, unknown>,
  schema: Schema,
): Record<string, unknown> {
  const result = { ...inputs };
  const { properties = {} } = schema.input;

  for (const [key, prop] of Object.entries(properties)) {
    if (!(key in result) && prop.default !== undefined) {
      result[key] = prop.default;
    }
  }

  return result;
}

/**
 * Validate and apply defaults in one step
 */
export function validateAndPrepare(
  inputs: Record<string, unknown>,
  schema: Schema,
): {
  valid: boolean;
  errors: ValidationError[];
  inputs: Record<string, unknown>;
} {
  const prepared = applyDefaults(inputs, schema);
  const validation = validateInputs(prepared, schema);

  return {
    ...validation,
    inputs: prepared,
  };
}
