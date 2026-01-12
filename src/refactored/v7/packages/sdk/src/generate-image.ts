// packages/sdk/src/generate-image.ts

import type {
  ImageModelV1,
  GenerateImageResult,
  GeneratedImage,
  AspectRatio,
} from './types';

export interface GenerateImageParams {
  model: ImageModelV1;
  prompt: string;
  n?: number;
  size?: `${number}x${number}`;
  aspectRatio?: AspectRatio;
  seed?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const {
    model,
    prompt,
    n = 1,
    size,
    aspectRatio,
    seed,
    providerOptions = {},
    abortSignal,
  } = params;

  // Get provider-specific options
  const modelProviderOptions = providerOptions[model.provider] ?? {};

  // Call model's doGenerate
  const result = await model.doGenerate({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions: modelProviderOptions,
    abortSignal,
  });

  // Convert to public format
  const images = result.images.map((file) => createGeneratedImage(file));

  return {
    images,
    image: images[0],
    warnings: result.warnings,
    response: result.response,
  };
}

function createGeneratedImage(file: {
  base64?: string;
  url?: string;
  uint8Array?: Uint8Array;
  mediaType: string;
}): GeneratedImage {
  let base64 = file.base64 ?? '';
  let uint8Array = file.uint8Array ?? new Uint8Array();

  // If we have URL, we'll need to fetch (lazy)
  // For now, assume base64 is provided
  if (file.base64 && !file.uint8Array) {
    uint8Array = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  }

  if (file.uint8Array && !file.base64) {
    base64 = btoa(String.fromCharCode(...file.uint8Array));
  }

  return {
    base64,
    uint8Array,
    mediaType: file.mediaType,
  };
}
