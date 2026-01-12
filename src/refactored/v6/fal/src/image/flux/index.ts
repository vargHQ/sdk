// packages/fal/src/image/flux/index.ts

import type { Model, GenerateResult } from '@varg/sdk';

const MODELS = ['v1.1', 'v1', 'dev', 'schnell'] as const;

export function flux(version: string): Model {
  if (!MODELS.includes(version as any)) {
    throw new Error(
      `Unknown version "${version}" for fal.image.flux. Available: ${MODELS.join(', ')}`
    );
  }

  return {
    provider: 'fal.image.flux',
    modelId: `fal.image.flux/${version}`,
    path: `fal-ai/flux-pro/${version}`,
    type: 'image',

    async doGenerate(params: Record<string, unknown>): Promise<GenerateResult> {
      const { getDefaultClient } = await import('../../client');
      const client = getDefaultClient();

      const mapped = {
        prompt: params.prompt,
        image_size: params.aspect_ratio,
        num_images: params.num_images ?? 1,
        guidance_scale: params.guidance_scale ?? 3.5,
        num_inference_steps: params.num_inference_steps ?? 28,
        seed: params.seed,
        image_url: params.image,
        strength: params.strength,
      };

      const raw = await client.run(this.path, mapped);
      return normalizeResult(raw);
    },
  };
}

function normalizeResult(raw: unknown): GenerateResult {
  const data = raw as Record<string, unknown>;
  const images = (data.images as Array<{ url: string }>) ?? [];

  return {
    files: images.map((img) => ({ url: img.url, mediaType: 'image/png' })),
    raw,
  };
}

flux.models = MODELS;
