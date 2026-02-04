import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { __resetWarningsForTesting } from "../ai-sdk/providers/editly/layers";
import { Clip, Image, Overlay, Render, render } from "./index";

describe("warnings", () => {
  const testImage = "media/cyberpunk-street.png";
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    __resetWarningsForTesting();
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test(
    "issue #45: warns when Overlay is placed inside Clip",
    async () => {
      const outPath = "output/test-issue-45.mp4";
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 2,
            children: [
              Image({ src: testImage }),
              Overlay({
                left: "10%",
                top: "10%",
                width: "20%",
                height: "20%",
                children: [Image({ src: testImage })],
              }),
            ],
          }),
        ],
      });

      await render(root, { output: outPath, quiet: true });

      const warnings = warnSpy.mock.calls.map(
        (call: unknown[]) => call[0] as string,
      );
      expect(
        warnings.some(
          (w: string) =>
            w.includes("Overlay") && w.includes("inside") && w.includes("Clip"),
        ),
      ).toBe(true);
      expect(existsSync(outPath)).toBe(true);
    },
    { timeout: 10000 },
  );

  test(
    "issue #24: warns when image with zoompan has no resizeMode",
    async () => {
      const outPath = "output/test-issue-24.mp4";
      const root = Render({
        width: 1280,
        height: 720,
        children: [
          Clip({
            duration: 2,
            children: [Image({ src: testImage, zoom: "in" })],
          }),
        ],
      });

      await render(root, { output: outPath, quiet: true });

      const warnings = warnSpy.mock.calls.map(
        (call: unknown[]) => call[0] as string,
      );
      expect(
        warnings.some(
          (w: string) => w.includes("resizeMode") && w.includes("Deprecation"),
        ),
      ).toBe(true);
      expect(existsSync(outPath)).toBe(true);
    },
    { timeout: 10000 },
  );
});
