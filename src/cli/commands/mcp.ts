/**
 * vargai search | show | install | skills | tools | call | mcp | whoami |
 * version — the varg MCP's CLI.
 *
 * Everything the varg MCP server does is also a command of @vargai/mcp
 * (`npx @vargai/mcp <command>`): varg how to search and install without a key,
 * and every MCP tool with one. These commands hand their words to it unchanged,
 * so vargai and the MCP never drift apart: a tool added to the server is a
 * `vargai mcp <tool>` command the same day, with nothing to change here.
 *
 * Where it runs from, first found: VARG_MCP_BIN (a local checkout), the
 * standalone vargai binary (~/.varg/bin/vargai, from
 * `curl -fsSL https://varg.ai/install | sh`), else @vargai/mcp from npm.
 *
 * Both read the same key: VARG_API_KEY, else ~/.varg/credentials (vargai login).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where the installer puts the standalone vargai. It hands init, run and
 *  the other SDK commands back here, so the two command sets stay disjoint. */
const BINARY = join(
  homedir(),
  ".varg",
  "bin",
  process.platform === "win32" ? "vargai.exe" : "vargai",
);

/** The first release of @vargai/mcp whose upload_file{path} stays in the
 *  project and asks first, and whose --http is loopback + token. Older ones
 *  read any local file and listened on every interface. */
const MCP_SPEC = "@vargai/mcp@^0.20.0";

/** First words handed to @vargai/mcp. `mcp` itself is dropped: `vargai mcp
 *  generate_image …` runs `generate_image …`. */
export const MCP_COMMANDS = new Set([
  "search",
  "show",
  "install",
  "skills",
  "skill",
  "tools",
  "call",
  "mcp",
  "whoami",
  "version",
]);

/** The command line that runs the varg MCP CLI with these words. VARG_MCP_BIN
 *  points at a local checkout's entry (src/index.ts or dist/index.js). */
export function mcpCommand(
  words: string[],
  binary: string | null = existsSync(BINARY) ? BINARY : null,
): string[] {
  const local = process.env.VARG_MCP_BIN;
  if (local) return [process.execPath, local, ...words];
  if (binary) return [binary, ...words];
  return [process.execPath, "x", MCP_SPEC, ...words];
}

/** `vargai <words>` → the words @vargai/mcp gets. */
export function mcpWords(argv: string[]): string[] {
  const [first, ...rest] = argv;
  if (first === "mcp") return rest.length ? rest : ["--help"];
  return argv;
}

/** Run @vargai/mcp with these words, wired to this terminal; resolves to its exit code. */
export function runMcp(argv: string[]): Promise<number> {
  const [bin = process.execPath, ...args] = mcpCommand(mcpWords(argv));
  return new Promise((resolve) => {
    // VARG_CLI_NAME: its hints then say `vargai mcp …`, which works here.
    const child = spawn(bin, args, {
      stdio: "inherit",
      env: { VARG_CLI_NAME: "vargai mcp", ...process.env },
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (e) => {
      console.error(`could not start the varg MCP CLI: ${e.message}`);
      resolve(1);
    });
  });
}
