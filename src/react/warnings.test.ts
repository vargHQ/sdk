import { describe, expect, test } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";

describe("warnings", () => {
  test(
    "issue #45: warns when Overlay is placed inside Clip",
    async () => {
      const script = `
import { Clip, Image, Overlay, Render, render } from "./src/react/index";
await render(
  Render({
    width: 1280,
    height: 720,
    children: [
      Clip({
        duration: 2,
        children: [
          Image({ src: "media/cyberpunk-street.png" }),
          Overlay({
            left: "10%",
            top: "10%",
            width: "20%",
            height: "20%",
            children: [Image({ src: "media/cyberpunk-street.png" })],
          }),
        ],
      }),
    ],
  }),
  { output: "output/test-issue-45.mp4", quiet: true }
);
`;
      const tmpFile = ".tmp-test-45.ts";
      writeFileSync(tmpFile, script);

      const proc = Bun.spawn(["bun", "run", tmpFile], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      await proc.exited;
      unlinkSync(tmpFile);

      const output = stdout + stderr;
      expect(output).toContain("Overlay");
      expect(output).toContain("Clip");
      expect(existsSync("output/test-issue-45.mp4")).toBe(true);
    },
    { timeout: 15000 },
  );

  test(
    "issue #24: warns when image with zoompan has no resizeMode",
    async () => {
      const script = `
import { Clip, Image, Render, render } from "./src/react/index";
await render(
  Render({
    width: 1280,
    height: 720,
    children: [
      Clip({
        duration: 2,
        children: [Image({ src: "media/cyberpunk-street.png", zoom: "in" })],
      }),
    ],
  }),
  { output: "output/test-issue-24.mp4", quiet: true }
);
`;
      const tmpFile = ".tmp-test-24.ts";
      writeFileSync(tmpFile, script);

      const proc = Bun.spawn(["bun", "run", tmpFile], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      await proc.exited;
      unlinkSync(tmpFile);

      const output = stdout + stderr;
      expect(output).toContain("resizeMode");
      expect(output).toContain("Deprecation");
      expect(existsSync("output/test-issue-24.mp4")).toBe(true);
    },
    { timeout: 15000 },
  );
});
