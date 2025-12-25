/**
 * Box rendering for terminal output
 */

// ANSI color codes
export const c = {
  reset: "\x1b[0m",
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  white: (s: string) => `\x1b[37m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
};

// Box drawing characters
const chars = {
  tl: "╭",
  tr: "╮",
  bl: "╰",
  br: "╯",
  h: "─",
  v: "│",
};

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Draw a box around content
 */
export function box(title: string, content: string[]): string {
  const width = 60;
  const innerWidth = width - 4;

  const lines: string[] = [];

  // Top border with title
  const titleLen = stripAnsi(title).length;
  const padding = Math.max(0, innerWidth - titleLen - 2);
  lines.push(
    c.dim(chars.tl + chars.h) +
      ` ${title} ` +
      c.dim(chars.h.repeat(padding) + chars.tr),
  );

  // Content
  for (const line of content) {
    const stripped = stripAnsi(line);
    const pad = Math.max(0, innerWidth - stripped.length);
    lines.push(`${c.dim(chars.v)} ${line}${" ".repeat(pad)} ${c.dim(chars.v)}`);
  }

  // Bottom border
  lines.push(c.dim(chars.bl + chars.h.repeat(width - 2) + chars.br));

  return lines.join("\n");
}

/**
 * Simple header
 */
export function header(text: string): string {
  return c.bold(c.dim(`  ${text}`));
}

/**
 * Separator line
 */
export function separator(): string {
  return c.dim(`  ${"─".repeat(54)}`);
}

/**
 * Running status box
 */
export function runningBox(
  action: string,
  params: Record<string, string>,
  status: "running" | "done" | "error",
  extra?: { output?: string; error?: string; time?: number },
): string {
  const statusIcon =
    status === "running"
      ? c.yellow("◐")
      : status === "done"
        ? c.green("✓")
        : c.red("✗");

  const statusText =
    status === "running"
      ? c.yellow("running")
      : status === "done"
        ? c.green("done")
        : c.red("error");

  const content: string[] = [];
  content.push("");
  content.push(`  ${statusIcon} ${statusText}`);
  content.push("");

  // Show params
  for (const [key, value] of Object.entries(params)) {
    const displayValue =
      value.length > 40 ? `${value.substring(0, 37)}...` : value;
    content.push(`  ${c.cyan(key.padEnd(12))} ${displayValue}`);
  }

  // Show extra info
  if (extra?.output) {
    content.push("");
    content.push(`  ${c.dim("output")}       ${extra.output}`);
  }

  if (extra?.error) {
    content.push("");
    content.push(`  ${c.red("error")}        ${extra.error}`);
  }

  if (extra?.time !== undefined) {
    const timeStr =
      extra.time > 1000
        ? `${(extra.time / 1000).toFixed(1)}s`
        : `${extra.time}ms`;
    content.push(`  ${c.dim("time")}         ${timeStr}`);
  }

  content.push("");

  return box(action, content);
}
