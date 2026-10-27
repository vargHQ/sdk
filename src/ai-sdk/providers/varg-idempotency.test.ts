import { describe, expect, test } from "bun:test";
import { computeIdempotencyKey } from "./varg";

describe("computeIdempotencyKey", () => {
  test("same params produce the same key (retry references the same job)", () => {
    const params = { model: "kling-v3", prompt: "sunset", duration: 6 };
    expect(computeIdempotencyKey("video", params)).toBe(
      computeIdempotencyKey("video", { ...params }),
    );
  });

  test("key ordering does not matter (canonical serialization)", () => {
    const a = { model: "kling-v3", prompt: "sunset", duration: 6 };
    const b = { duration: 6, prompt: "sunset", model: "kling-v3" };
    expect(computeIdempotencyKey("video", a)).toBe(
      computeIdempotencyKey("video", b),
    );
  });

  test("nested object ordering does not matter", () => {
    const a = {
      prompt: "x",
      provider_options: { fal: { generate_audio: true, resolution: "720p" } },
    };
    const b = {
      provider_options: { fal: { resolution: "720p", generate_audio: true } },
      prompt: "x",
    };
    expect(computeIdempotencyKey("video", a)).toBe(
      computeIdempotencyKey("video", b),
    );
  });

  test("different params produce different keys", () => {
    expect(computeIdempotencyKey("video", { prompt: "sunset" })).not.toBe(
      computeIdempotencyKey("video", { prompt: "sunrise" }),
    );
  });

  test("different capabilities produce different keys", () => {
    expect(computeIdempotencyKey("video", { prompt: "x" })).not.toBe(
      computeIdempotencyKey("image", { prompt: "x" }),
    );
  });

  test("array order matters (images order is semantic)", () => {
    expect(computeIdempotencyKey("image", { images: ["a", "b"] })).not.toBe(
      computeIdempotencyKey("image", { images: ["b", "a"] }),
    );
  });
});
