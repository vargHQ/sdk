import { describe, expect, test } from "bun:test";
import { editlyWeb } from "./index";

describe("editly-web", () => {
  test("requires at least one clip", async () => {
    await expect(
      editlyWeb({
        clips: [],
        sources: new Map(),
      }),
    ).rejects.toThrow("At least one clip is required");
  });
});
