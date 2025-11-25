/**
 * terminal ui helpers for varg cli
 * beautiful boxes and formatting
 */

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

export const c = {
  reset: (s: string) => `${COLORS.reset}${s}${COLORS.reset}`,
  bold: (s: string) => `${COLORS.bold}${s}${COLORS.reset}`,
  dim: (s: string) => `${COLORS.dim}${s}${COLORS.reset}`,
  green: (s: string) => `${COLORS.green}${s}${COLORS.reset}`,
  yellow: (s: string) => `${COLORS.yellow}${s}${COLORS.reset}`,
  blue: (s: string) => `${COLORS.blue}${s}${COLORS.reset}`,
  magenta: (s: string) => `${COLORS.magenta}${s}${COLORS.reset}`,
  cyan: (s: string) => `${COLORS.cyan}${s}${COLORS.reset}`,
  red: (s: string) => `${COLORS.red}${s}${COLORS.reset}`,
  gray: (s: string) => `${COLORS.gray}${s}${COLORS.reset}`,
};

// strip ansi codes for length calculation
// biome-ignore lint/complexity/useRegexLiterals: literal triggers noControlCharactersInRegex
const ANSI_REGEX = new RegExp("\x1b\\[[0-9;]*m", "g");
function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, "");
}

// box drawing characters
const BOX = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  line: "─",
};

export const WIDTH = 71;

export function box(title: string, content: string[]): string {
  const lines: string[] = [];

  // top border with title
  const titlePart = title ? `${BOX.line} ${title} ` : "";
  const remainingWidth = WIDTH - 2 - stripAnsi(titlePart).length;
  lines.push(
    `${BOX.topLeft}${titlePart}${BOX.horizontal.repeat(remainingWidth)}${BOX.topRight}`,
  );

  // content lines
  for (const line of content) {
    const stripped = stripAnsi(line);
    const padding = WIDTH - 2 - stripped.length;
    if (padding >= 0) {
      lines.push(`${BOX.vertical}${line}${" ".repeat(padding)}${BOX.vertical}`);
    } else {
      // truncate if too long
      lines.push(
        `${BOX.vertical}${line.slice(0, WIDTH - 5)}...${BOX.vertical}`,
      );
    }
  }

  // bottom border
  lines.push(
    `${BOX.bottomLeft}${BOX.horizontal.repeat(WIDTH - 2)}${BOX.bottomRight}`,
  );

  return lines.join("\n");
}

export function separator(): string {
  return `  ${c.dim(BOX.horizontal.repeat(WIDTH - 4))}`;
}

export function header(text: string): string {
  return c.bold(c.dim(`  ${text}`));
}

export function row(label: string, value: string, indent = 2): string {
  const spaces = " ".repeat(indent);
  const labelWidth = 14;
  const paddedLabel = label.padEnd(labelWidth);
  return `${spaces}${c.dim(paddedLabel)}${value}`;
}

export function success(message: string): string {
  return `  ${c.green("✓")} ${message}`;
}

export function error(message: string): string {
  return `  ${c.red("✗")} ${message}`;
}

export function spinner(message: string): string {
  return `  ${c.cyan("◐")} ${message}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  return `${s}s`;
}

export function formatCost(dollars: number): string {
  return `$${dollars.toFixed(3)}`;
}

// table formatting for list command
export interface TableRow {
  name: string;
  description: string;
  providers?: string;
}

export function table(rows: TableRow[], nameWidth = 16): string[] {
  const lines: string[] = [];

  for (const row of rows) {
    const name = row.name.padEnd(nameWidth);
    const desc = row.description;
    const providers = row.providers ? c.dim(row.providers) : "";

    if (providers) {
      lines.push(`  ${c.cyan(name)}${desc.padEnd(30)}${providers}`);
    } else {
      lines.push(`  ${c.cyan(name)}${desc}`);
    }
  }

  return lines;
}

// progress output for running commands
export function runningBox(
  name: string,
  params: Record<string, string>,
  status: "running" | "done" | "error",
  result?: { output?: string; cost?: number; error?: string; time?: number },
): string {
  const content: string[] = [""];

  // params
  for (const [key, value] of Object.entries(params)) {
    const displayValue =
      value.length > 40 ? `"${value.slice(0, 37)}..."` : `"${value}"`;
    content.push(row(key, displayValue));
  }

  content.push("");

  // status
  if (status === "running") {
    content.push(spinner("generating..."));
  } else if (status === "done" && result) {
    content.push(success(`done in ${formatDuration(result.time || 0)}`));
    content.push("");
    if (result.output) {
      content.push(row("output", result.output));
    }
    if (result.cost) {
      content.push(row("cost", formatCost(result.cost)));
    }
  } else if (status === "error" && result?.error) {
    content.push(error("failed"));
    content.push("");
    content.push(row("error", result.error));
  }

  content.push("");

  return box(name, content);
}
