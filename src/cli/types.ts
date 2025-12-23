/**
 * CLI type definitions
 */

export interface NotFoundOptions {
  /** Suggested alternatives */
  suggestions?: string[];
  /** Max number of suggestions to show */
  maxSuggestions?: number;
  /** Custom hint message */
  hint?: string;
  /** Color function for error text */
  errorColorFn?: (s: string) => string;
  /** Color function for hints */
  hintColorFn?: (s: string) => string;
  /** Whether to exit process (default: true) */
  exit?: boolean;
}

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
