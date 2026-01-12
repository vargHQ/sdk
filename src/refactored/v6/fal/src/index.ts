// packages/fal/src/index.ts

import { createFalClient, getFalClient } from './client';
import { video } from './video';
import { image } from './image';
import { audio } from './audio';
import type { Model, GenerateResult } from '@varg/sdk';
import { createGeneratedFile, inferMediaType } from '@varg/sdk';

export const fal = {
  name: 'fal' as const,
  baseURL: 'https://queue.fal.run',

  async doGenerate(params: Record<string, unknown>, model: Model): Promise<GenerateResult> {
    const raw = await getFalClient().run(model.path, params);
    return normalizeResult(raw, model.type);
  },

  video,
  image,
  audio,
  client: getFalClient,
  createClient: createFalClient,
} as const;

function normalizeResult(raw: unknown, type: Model['type']): GenerateResult {
  const data = raw as Record<string, unknown>;
  const mediaType = inferMediaType(type);

  if (type === 'video') {
    const url = (data.video as { url?: string })?.url;
    return { files: url ? [createGeneratedFile({ url, mediaType })] : [], raw };
  }
  if (type === 'image') {
    const images = (data.images as Array<{ url: string }>) ?? [];
    return { files: images.map(i => createGeneratedFile({ url: i.url, mediaType })), raw };
  }
  if (type === 'audio') {
    const url = (data.audio as { url?: string })?.url ?? (data as { audio_url?: string }).audio_url;
    return { files: url ? [createGeneratedFile({ url, mediaType })] : [], raw };
  }
  return { files: [], raw };
}

export { createFalClient, getFalClient } from './client';
export type { FalClientConfig } from './client';
