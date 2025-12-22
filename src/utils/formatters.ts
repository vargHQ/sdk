/**
 * Shared formatting utilities for CLI and SDK
 */

import type { Definition } from "../core/schema/types";

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
 * Format schema input properties for display
 */
export function formatSchemaInputs(
  schema: {
    input: {
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  },
  options: {
    indent?: string;
    colorFn?: (s: string) => string;
    dimFn?: (s: string) => string;
  } = {},
): string[] {
  const { indent = "    ", colorFn = (s) => s, dimFn = (s) => s } = options;

  return Object.entries(schema.input.properties).map(([key, prop]) => {
    const req = schema.input.required.includes(key) ? colorFn("*") : " ";
    const type = dimFn(`<${prop.type}>`);
    return `${indent}${req} ${key.padEnd(15)} ${type} ${prop.description}`;
  });
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
