import { describe, expect, test } from "bun:test";
import { fal } from "../../ai-sdk/providers/fal";
import { Image, Video } from "../elements";
import { computeCacheKey } from "./utils";

describe("computeCacheKey", () => {
  test("ignores layout props for images", () => {
    const base = Image({
      prompt: "lion on a couch",
      model: fal.imageModel("flux-schnell"),
      aspectRatio: "16:9",
    });

    const variant = Image({
      prompt: "lion on a couch",
      model: fal.imageModel("flux-schnell"),
      aspectRatio: "16:9",
      left: "10%",
      top: "5%",
      width: "50%",
      height: "50%",
      resize: "cover",
      zoom: "in",
      key: "layout-1",
    });

    expect(computeCacheKey(base)).toEqual(computeCacheKey(variant));
  });

  test("ignores trim/audio/layout props for videos", () => {
    const base = Video({
      prompt: "walk forward, confident stride",
      model: fal.videoModel("kling-v2.5"),
      aspectRatio: "9:16",
    });

    const variant = Video({
      prompt: "walk forward, confident stride",
      model: fal.videoModel("kling-v2.5"),
      aspectRatio: "9:16",
      cutFrom: 0.5,
      cutTo: 2.5,
      left: "15%",
      width: "70%",
      keepAudio: true,
      volume: 0.5,
      key: "clip-2",
    });

    expect(computeCacheKey(base)).toEqual(computeCacheKey(variant));
  });

  test("changes when prompt changes", () => {
    const a = Image({
      prompt: "lion on a couch",
      model: fal.imageModel("flux-schnell"),
    });

    const b = Image({
      prompt: "tiger on a couch",
      model: fal.imageModel("flux-schnell"),
    });

    expect(computeCacheKey(a)).not.toEqual(computeCacheKey(b));
  });

  test("changes when model changes", () => {
    const a = Video({
      prompt: "walk forward",
      model: fal.videoModel("kling-v2.5"),
    });

    const b = Video({
      prompt: "walk forward",
      model: fal.videoModel("wan-2.5"),
    });

    expect(computeCacheKey(a)).not.toEqual(computeCacheKey(b));
  });
});
