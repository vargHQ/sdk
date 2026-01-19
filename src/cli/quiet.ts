/**
 * Quiet mode setup - must be imported first
 * Suppresses console.log for --json and --quiet modes
 */

const args = process.argv.slice(2);
export const isQuietMode = args.includes("--json") || args.includes("--quiet");

// Store original write function
const _originalWrite = process.stdout.write.bind(process.stdout);

if (isQuietMode) {
  // Override process.stdout.write to filter non-JSON output
  process.stdout.write = ((
    // biome-ignore lint/suspicious/noExplicitAny: complex overload signature
    chunk: any,
    // biome-ignore lint/suspicious/noExplicitAny: complex overload signature
    encoding?: any,
    // biome-ignore lint/suspicious/noExplicitAny: complex overload signature
    callback?: any,
  ): boolean => {
    const str = typeof chunk === "string" ? chunk : chunk.toString();
    const trimmed = str.trim();

    // Only allow JSON output (starts with { or [) or empty lines
    if (trimmed === "" || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return _originalWrite(chunk, encoding, callback);
    }

    // Suppress non-JSON output, still call callback if provided
    if (typeof encoding === "function") {
      encoding();
    } else if (callback) {
      callback();
    }
    return true;
  }) as typeof process.stdout.write;
}

// Export for direct output when needed (bypasses quiet mode)
export function rawLog(...args: unknown[]): void {
  const message = `${args.map(String).join(" ")}\n`;
  _originalWrite(message);
}
