import { describe, expect, test } from "bun:test";
import { MCP_COMMANDS, mcpCommand, mcpWords } from "./mcp";

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

  test("runs a release with the CLI, or a local checkout", () => {
    const saved = process.env.VARG_MCP_BIN;
    delete process.env.VARG_MCP_BIN;
    expect(mcpCommand(["version"]).slice(1)).toEqual([
      "x",
      "@vargai/mcp@^0.16.0",
      "version",
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
    for (const own of ["login", "logout", "balance", "find", "list", "run"]) {
      expect(MCP_COMMANDS.has(own)).toBe(false);
    }
  });
});
