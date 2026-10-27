import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { ensureFixtures } from "../tests/fixtures";

/**
 * These tests render in a child process and assert on its output. The image
 * fixture is downloaded from R2 rather than read from gitignored media/, so
 * they are reproducible on a fresh checkout.
 */
describe("warnings", () => {
  let testImage = "";

  beforeAll(async () => {
    [testImage] = (await ensureFixtures("test-red.png")) as [string];
  });

  /**
   * Run a generated script in a child process and return its combined output.
   *
   * Asserts a clean exit first: these tests check side effects (a file exists,
   * a warning was printed), so without this a hard crash in the child shows up
   * as a confusing assertion diff instead of "the subprocess failed".
   */
  async function runScript(tmpFile: string, script: string): Promise<string> {
    writeFileSync(tmpFile, script);
    try {
      const proc = Bun.spawn(["bun", "run", tmpFile], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      const output = stdout + stderr;
      if (exitCode !== 0) {
        throw new Error(
          `child process exited with code ${exitCode}:\n${output}`,
        );
      }
      return output;
    } finally {
      if (existsSync(tmpFile)) unlinkSync(tmpFile);
    }
  }

  test(
    "issue #45: Overlay inside Clip renders without warning",
    async () => {
      const output = await runScript(
        ".tmp-test-45.ts",
        `
import { Clip, Image, Overlay, Render, render } from "./src/react/index";
await render(
  Render({
    width: 1280,
    height: 720,
    children: [
      Clip({
        duration: 2,
        children: [
          Image({ src: ${JSON.stringify(testImage)} }),
          Overlay({
            left: "10%",
            top: "10%",
            width: "20%",
            height: "20%",
            children: [Image({ src: ${JSON.stringify(testImage)} })],
          }),
        ],
      }),
    ],
  }),
  { output: "output/test-issue-45.mp4", quiet: true }
);
`,
      );

      // <Overlay> inside <Clip> is now valid — no warning should be emitted
      expect(output).not.toContain(
        "<Overlay> placed inside <Clip> will be ignored",
      );
      expect(existsSync("output/test-issue-45.mp4")).toBe(true);
    },
    { timeout: 15000 },
  );

  test(
    "issue #24: warns when image with zoompan has no resizeMode",
    async () => {
      const output = await runScript(
        ".tmp-test-24.ts",
        `
import { Clip, Image, Render, render } from "./src/react/index";
await render(
  Render({
    width: 1280,
    height: 720,
    children: [
      Clip({
        duration: 2,
        children: [Image({ src: ${JSON.stringify(testImage)}, zoom: "in" })],
      }),
    ],
  }),
  { output: "output/test-issue-24.mp4", quiet: true }
);
`,
      );

      expect(output).toContain("resizeMode");
      expect(output).toContain("Deprecation");
      expect(existsSync("output/test-issue-24.mp4")).toBe(true);
    },
    { timeout: 15000 },
  );
});
