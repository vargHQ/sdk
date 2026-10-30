/**
 * Commands the vargai CLI no longer has. JSX/TSX videos are deprecated, so the
 * CLI stopped rendering them: these words answer with where to go instead of
 * falling through to "unknown command".
 */

export const REMOVED_COMMANDS = new Set([
  "render",
  "preview",
  "frame",
  "storyboard",
  "studio",
  "hello",
]);

export function showRemoved(command: string): void {
  console.error(`vargai ${command} was removed: JSX/TSX videos are deprecated and the CLI no longer renders them.

Make videos with the varg MCP tools instead, from this terminal:
  vargai mcp generate_video --prompt "waves at dusk" --duration 5
  vargai mcp generate_image "a red fox in snow"
  vargai mcp get_tool ffmpeg       the ffmpeg tool: cut, join, mix, caption
                                   (run it with vargai mcp call_tool)
  vargai tools                     every tool

Or install the standalone vargai: curl -fsSL https://varg.ai/install | sh`);
}
