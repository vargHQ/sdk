/**
 * Spinner for terminal progress indication
 */

import { c } from "./box";

const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];

export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length];
      process.stdout.write(`\r${c.yellow(frame ?? "◐")} ${this.message}`);
      this.frameIndex++;
    }, 100);
  }

  stop(success = true): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const icon = success ? c.green("✓") : c.red("✗");
    process.stdout.write(`\r${icon} ${this.message}\n`);
  }

  update(message: string): void {
    this.message = message;
  }
}

/**
 * Create and start a spinner
 */
export function spinner(message: string): Spinner {
  const s = new Spinner(message);
  s.start();
  return s;
}

/**
 * Progress bar
 */
export function progressBar(
  progress: number,
  width = 30,
  label?: string,
): string {
  const filled = Math.round(progress * width);
  const empty = width - filled;

  const bar = c.cyan("█".repeat(filled)) + c.dim("░".repeat(empty));
  const percent = Math.round(progress * 100);
  const labelStr = label ? ` ${label}` : "";

  return `${bar} ${percent}%${labelStr}`;
}
