import { describe, expect, test } from "bun:test";
import {
  generateImage,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createElevenLabs, elevenlabs } from "./elevenlabs-provider";
import { createFal, fal } from "./fal-provider";
import { createHiggsfield, higgsfield } from "./providers/higgsfield";
import { createOpenAI, openai } from "./providers/openai";
import { createReplicate, replicate } from "./providers/replicate";

const runLiveTests = process.env.RUN_LIVE_TESTS === "true";
const hasFalKey = runLiveTests && !!process.env.FAL_API_KEY;
const hasElevenLabsKey = runLiveTests && !!process.env.ELEVENLABS_API_KEY;

describe("ai-sdk providers", () => {
  describe("fal provider", () => {
    test("creates provider instance", () => {
      expect(fal).toBeDefined();
      expect(typeof fal.imageModel).toBe("function");
      expect(typeof fal.videoModel).toBe("function");
    });

    test("creates custom instance with createFal", () => {
      const custom = createFal({ apiKey: "test-key" });
      expect(custom).toBeDefined();
      expect(typeof custom.imageModel).toBe("function");
    });

    test("imageModel returns valid model", () => {
      const model = fal.imageModel("flux-schnell");
      expect(model.provider).toBe("fal");
      expect(model.modelId).toBe("flux-schnell");
      expect(model.specificationVersion).toBe("v3");
    });

    test("videoModel returns valid model", () => {
      const model = fal.videoModel("kling-v2.5");
      expect(model.provider).toBe("fal");
      expect(model.modelId).toBe("kling-v2.5");
    });

    test.skipIf(!hasFalKey)("generates image with flux-schnell", async () => {
      const { images } = await generateImage({
        model: fal.imageModel("flux-schnell"),
        prompt: "a red circle on white background",
      });
      expect(images.length).toBeGreaterThan(0);
      expect(images[0]?.uint8Array).toBeInstanceOf(Uint8Array);
    });
  });

  describe("elevenlabs provider", () => {
    test("creates provider instance", () => {
      expect(elevenlabs).toBeDefined();
      expect(typeof elevenlabs.speechModel).toBe("function");
      expect(typeof elevenlabs.musicModel).toBe("function");
    });

    test("creates custom instance with createElevenLabs", () => {
      const custom = createElevenLabs({ apiKey: "test-key" });
      expect(custom).toBeDefined();
      expect(typeof custom.speechModel).toBe("function");
    });

    test("speechModel returns valid model", () => {
      const model = elevenlabs.speechModel("turbo");
      expect(model.provider).toBe("elevenlabs");
      expect(model.specificationVersion).toBe("v3");
    });

    test.skipIf(!hasElevenLabsKey)("generates speech", async () => {
      const { audio } = await generateSpeech({
        model: elevenlabs.speechModel("turbo"),
        text: "Hello world",
        voice: "rachel",
      });
      expect(audio.uint8Array).toBeInstanceOf(Uint8Array);
      expect(audio.uint8Array.length).toBeGreaterThan(0);
    });
  });

  describe("higgsfield provider", () => {
    test("creates provider instance", () => {
      expect(higgsfield).toBeDefined();
      expect(typeof higgsfield.imageModel).toBe("function");
    });

    test("creates custom instance with createHiggsfield", () => {
      const custom = createHiggsfield({
        apiKey: "test-key",
        apiSecret: "test-secret",
      });
      expect(custom).toBeDefined();
    });

    test("imageModel returns valid model", () => {
      const model = higgsfield.imageModel("soul");
      expect(model.provider).toBe("higgsfield");
      expect(model.modelId).toBe("soul");
    });
  });

  describe("openai provider", () => {
    test("creates provider instance", () => {
      expect(openai).toBeDefined();
      expect(typeof openai.videoModel).toBe("function");
    });

    test("creates custom instance with createOpenAI", () => {
      const custom = createOpenAI({ apiKey: "test-key" });
      expect(custom).toBeDefined();
    });

    test("videoModel returns valid model", () => {
      const model = openai.videoModel("sora-2");
      expect(model.provider).toBe("openai");
      expect(model.modelId).toBe("sora-2");
    });
  });

  describe("replicate provider", () => {
    test("creates provider instance", () => {
      expect(replicate).toBeDefined();
      expect(typeof replicate.imageModel).toBe("function");
    });

    test("creates custom instance with createReplicate", () => {
      const custom = createReplicate({ apiToken: "test-token" });
      expect(custom).toBeDefined();
    });
  });
});

describe("provider swapping", () => {
  test("image providers share same interface", async () => {
    const falModel = fal.imageModel("flux-schnell");
    const higgsfieldModel = higgsfield.imageModel("soul");

    expect(falModel.specificationVersion).toBe("v3");
    expect(higgsfieldModel.specificationVersion).toBe("v3");
    expect(typeof falModel.doGenerate).toBe("function");
    expect(typeof higgsfieldModel.doGenerate).toBe("function");
  });

  test("video providers share same interface", async () => {
    const falModel = fal.videoModel("kling-v2.5");
    const openaiModel = openai.videoModel("sora-2");

    expect(falModel.specificationVersion).toBe("v3");
    expect(openaiModel.specificationVersion).toBe("v3");
    expect(typeof falModel.doGenerate).toBe("function");
    expect(typeof openaiModel.doGenerate).toBe("function");
  });

  test.skipIf(!hasFalKey)(
    "generateImage works with swappable providers",
    async () => {
      const providers = [
        { name: "fal", model: fal.imageModel("flux-schnell") },
      ];

      for (const { name, model } of providers) {
        const { images } = await generateImage({
          model,
          prompt: "test image",
        });
        expect(images.length).toBeGreaterThan(0);
        console.log(`✓ ${name} provider works`);
      }
    },
  );
});
