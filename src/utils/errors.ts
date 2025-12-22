/**
 * Shared error handling utilities
 */

/**
 * Options for handleNotFound
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

/**
 * Handle "not found" errors consistently
 * Displays error message with optional suggestions and exits
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
 * Handle validation errors consistently
 */
export function handleValidationError(
  field: string,
  message: string,
  options: { colorFn?: (s: string) => string; hint?: string } = {},
): void {
  const { colorFn = (s) => s, hint } = options;

  console.error(`\n  ${colorFn("error:")} --${field} ${message}\n`);

  if (hint) {
    console.log(`  ${hint}\n`);
  }
}

/**
 * Format an error for display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
