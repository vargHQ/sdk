// packages/fal/video/kling/index.ts

import type { GenerateResult, Model, VideoGenerateParams } from "@varg/sdk";
import { createModelProvider } from "@varg/sdk";
import { fal } from "../../";

export const kling = createModelProvider({
  name: "fal.video.kling",
  type: "video",
  path: "kling-ai/kling-video",
  models: ["v2.5-pro", "v2.5-turbo", "v1.6-pro", "v1.6-standard"],

  mapParams(params: VideoGenerateParams): Record<string, unknown> {
    return {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      aspect_ratio: params.aspectRatio,
      duration: params.duration ? `${params.duration}s` : undefined,
      cfg_scale: params.providerOptions?.cfgScale ?? 0.5,
      mode: params.providerOptions?.mode ?? "std",
      seed: params.seed,
    };
  },

  async doGenerate(
    params: VideoGenerateParams,
    model: Model,
  ): Promise<GenerateResult> {
    const mapped = this.mapParams(params);
    return fal.doGenerate(mapped, model);
  },
});
