// packages/fal/src/video/kling/index.ts

import { createModelProvider } from '@varg/sdk';
import type { BaseGenerateParams, Model, GenerateResult } from '@varg/sdk';
import { fal } from '../../';

function mapParams(params: BaseGenerateParams): Record<string, unknown> {
  const opts = params.providerOptions as Record<string, unknown> | undefined;
  return {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt ?? opts?.negativePrompt,
    aspect_ratio: params.aspectRatio,
    duration: params.duration ? `${params.duration}s` : undefined,
    seed: params.seed,
    cfg_scale: opts?.cfgScale ?? 0.5,
    mode: opts?.mode ?? 'std',
    ...(params.image && { image_url: params.image.url ?? params.image.base64 }),
  };
}

export const kling = createModelProvider({
  name: 'fal.video.kling',
  type: 'video',
  path: 'kling-ai/kling-video',
  models: ['v2.5-pro', 'v2.5-turbo', 'v1.6-pro', 'v1.6-standard', 'v1.5-pro'],
  mapParams,
  async doGenerate(params: Record<string, unknown>, model: Model): Promise<GenerateResult> {
    return fal.doGenerate(params, model);
  },
});
