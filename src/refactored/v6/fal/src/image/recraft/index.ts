// packages/fal/src/image/recraft/index.ts

import type { Model, GenerateResult } from '@varg/sdk';

const MODELS = ['v3', 'v3-svg'] as const;

export function recraft(version: string): Model {
  if (!MODELS.includes(version as any)) {
    throw new Error(
      `Unknown version "${version}" for fal.image.recraft. Available: ${MODELS.join(', ')}`
    );
  }

  return {
    provider: 'fal.image.recraft',
    modelId: `fal.image.recraft/${version}`,
    path: `fal-ai/recraft-v3/${version}`,
    type: 'image',

    async doGenerate(params: Record<string, unknown>): Promise<GenerateResult> {
      const { getDefaultClient } = await import('../../client');
      const client = getDefaultClient();

      const mapped = {
        prompt: params.prompt,
        image_size: params.aspect_ratio,
        style: params.style ?? 'realistic_image',
        seed: params.seed,
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

recraft.models = MODELS;
