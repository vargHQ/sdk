/**
 * Table rendering for terminal output
 */

import { c } from "./box";

export interface TableRow {
  name: string;
  description: string;
  type?: string;
}

/**
 * Render a simple table
 */
export function table(rows: TableRow[]): string[] {
  const lines: string[] = [];

  for (const row of rows) {
    const typeTag = row.type ? `${c.dim(`[${row.type}]`)} ` : "";
    lines.push(
      `    ${c.cyan(row.name.padEnd(16))} ${typeTag}${row.description}`,
    );
  }

  return lines;
}

/**
 * Render a detailed table with columns
 */
export function detailedTable(
  rows: Array<Record<string, string>>,
  columns: string[],
): string[] {
  const lines: string[] = [];

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
    for (const row of rows) {
      const value = row[col] ?? "";
      widths[col] = Math.max(widths[col] ?? 0, value.length);
    }
  }

  // Header
  const headerLine = columns
    .map((col) => c.bold(col.toUpperCase().padEnd(widths[col] ?? 0)))
    .join("  ");
  lines.push(`    ${headerLine}`);

  // Separator
  const sep = columns.map((col) => "─".repeat(widths[col] ?? 0)).join("──");
  lines.push(`    ${c.dim(sep)}`);

  // Rows
  for (const row of rows) {
    const rowLine = columns
      .map((col) => (row[col] ?? "").padEnd(widths[col] ?? 0))
      .join("  ");
    lines.push(`    ${rowLine}`);
  }

  return lines;
}
