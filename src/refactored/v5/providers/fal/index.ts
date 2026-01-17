// packages/fal/index.ts

import type { GenerateParams, GenerateResult, Model } from "../../types";
import { audio } from "./audio";
import { createFalClient, falClient } from "./client";
import { image } from "./image";
import { video } from "./video";

export const fal = {
  name: "fal",

  // Run generation through fal infrastructure
  async doGenerate(
    params: Record<string, unknown>,
    model: Model,
  ): Promise<GenerateResult> {
    const result = await falClient.run(model.path, params);
    return normalizeResult(result, model.type);
  },

  // Modalities
  video,
  image,
  audio,

  // Expose client for advanced usage
  client: falClient,
  createClient: createFalClient,
};

// Normalize fal response → unified GenerateResult
function normalizeResult(result: unknown, type: Model["type"]): GenerateResult {
  // Fal returns different shapes per model, normalize to our format
  const data = result as Record<string, unknown>;

  if (type === "video") {
    const video = data.video as { url: string } | undefined;
    return {
      files: video ? [{ url: video.url, mediaType: "video/mp4" }] : [],
      raw: result,
    };
  }

  if (type === "image") {
    const images = (data.images as Array<{ url: string }>) ?? [];
    return {
      files: images.map((img) => ({ url: img.url, mediaType: "image/png" })),
      raw: result,
    };
  }

  if (type === "audio") {
    const audio = data.audio as { url: string } | undefined;
    return {
      files: audio ? [{ url: audio.url, mediaType: "audio/mp3" }] : [],
      raw: result,
    };
  }

  return { files: [], raw: result };
}

export type { FalClientConfig } from "./client";
// Re-exports
export { createFalClient } from "./client";
