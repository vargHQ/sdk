// packages/fal/src/video/runway/index.ts

import { createModelProvider } from '@varg/sdk';
import type { BaseGenerateParams, Model, GenerateResult } from '@varg/sdk';
import { fal } from '../../';

function mapParams(params: BaseGenerateParams): Record<string, unknown> {
  const opts = params.providerOptions as Record<string, unknown> | undefined;
  return {
    prompt_text: params.prompt,
    ratio: params.aspectRatio,
    seconds: params.duration,
    seed: params.seed,
    watermark: opts?.watermark ?? false,
    ...(params.image && { image_url: params.image.url ?? params.image.base64 }),
  };
}

export const runway = createModelProvider({
  name: 'fal.video.runway',
  type: 'video',
  path: 'runway/gen3a/turbo',
  models: ['turbo', 'standard'],
  mapParams,
  async doGenerate(params: Record<string, unknown>, model: Model): Promise<GenerateResult> {
    return fal.doGenerate(params, model);
  },
});
