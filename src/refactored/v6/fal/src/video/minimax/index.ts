// packages/fal/src/video/minimax/index.ts

import type { Model, GenerateResult } from '@varg/sdk';

const MODELS = ['standard', 'hd'] as const;

export function minimax(version: string): Model {
  if (!MODELS.includes(version as any)) {
    throw new Error(
      `Unknown version "${version}" for fal.video.minimax. Available: ${MODELS.join(', ')}`
    );
  }

  return {
    provider: 'fal.video.minimax',
    modelId: `fal.video.minimax/${version}`,
    path: `fal-ai/minimax/video-01/${version}`,
    type: 'video',

    async doGenerate(params: Record<string, unknown>): Promise<GenerateResult> {
      const { getDefaultClient } = await import('../../client');
      const client = getDefaultClient();

      const raw = await client.run(this.path, params);
      return normalizeResult(raw);
    },
  };
}

function normalizeResult(raw: unknown): GenerateResult {
  const data = raw as Record<string, unknown>;
  const video = data.video as { url: string } | undefined;

  return {
    files: video ? [{ url: video.url, mediaType: 'video/mp4' }] : [],
    raw,
  };
}

minimax.models = MODELS;
