import { describe, expect, test } from "bun:test";
import { MCP_COMMANDS, mcpCommand, mcpWords } from "./mcp";
import { REMOVED_COMMANDS } from "./removed";

describe("vargai → @vargai/mcp", () => {
  test("mcp drops itself; the other commands pass through unchanged", () => {
    expect(mcpWords(["mcp", "generate_image", "a fox"])).toEqual([
      "generate_image",
      "a fox",
    ]);
    expect(mcpWords(["mcp"])).toEqual(["--help"]);
    expect(mcpWords(["skills", "search", "captions"])).toEqual([
      "skills",
      "search",
      "captions",
    ]);
  });

  test("runs a local checkout, the installed binary, or a release from npm", () => {
    const saved = process.env.VARG_MCP_BIN;
    delete process.env.VARG_MCP_BIN;
    expect(mcpCommand(["version"], null).slice(1)).toEqual([
      "x",
      "@vargai/mcp@^0.16.0",
      "version",
    ]);
    expect(mcpCommand(["search", "x"], "/home/me/.varg/bin/vargai")).toEqual([
      "/home/me/.varg/bin/vargai",
      "search",
      "x",
    ]);
    process.env.VARG_MCP_BIN = "/src/mcp/src/index.ts";
    expect(mcpCommand(["tools"]).slice(1)).toEqual([
      "/src/mcp/src/index.ts",
      "tools",
    ]);
    if (saved === undefined) delete process.env.VARG_MCP_BIN;
    else process.env.VARG_MCP_BIN = saved;
  });

  test("does not take over vargai's own commands", () => {
    // The binary hands exactly these back to the vargai package; overlap would loop.
    const sdk = [
      "run",
      "init",
      "list",
      "ls",
      "find",
      "which",
      "inspect",
      "topup",
    ];
    for (const own of [
      ...sdk,
      ...REMOVED_COMMANDS,
      "login",
      "logout",
      "balance",
    ]) {
      expect(MCP_COMMANDS.has(own)).toBe(false);
    }
  });
});
