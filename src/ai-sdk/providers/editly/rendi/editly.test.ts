import { describe, expect, test } from "bun:test";
import { editly } from "../index";
import { createRendiBackend } from ".";

describe("editly with rendi backend", () => {
  test("simple video trim with rendi", async () => {
    const outputPath = "output/editly-rendi-test.mp4";

    await editly({
      outPath: outputPath,
      backend: createRendiBackend(),
      verbose: true,
      clips: [
        {
          duration: 2,
          layers: [
            {
              type: "video",
              path: "https://storage.rendi.dev/sample/big_buck_bunny_720p_5sec_intro.mp4",
              cutFrom: 0,
              cutTo: 2,
            },
          ],
        },
      ],
    });

    const file = Bun.file(outputPath);
    expect(await file.exists()).toBe(true);
    expect(file.size).toBeGreaterThan(0);
  }, 120000);
});
