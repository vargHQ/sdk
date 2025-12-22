/**
 * Shared utilities
 * Common functions used across CLI and SDK
 */

// Content building
export { ContentBuilder, createContentBuilder } from "./content-builder";
export type { ContentBuilderOptions } from "./content-builder";

// Error handling
export { formatError, handleNotFound, handleValidationError } from "./errors";
export type { NotFoundOptions } from "./errors";

// Formatting
export {
  definitionsToRows,
  definitionToRow,
  formatDuration,
  formatFileSize,
  formatSchemaInputs,
  truncate,
} from "./formatters";
