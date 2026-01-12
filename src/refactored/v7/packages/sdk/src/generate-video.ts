// packages/sdk/src/generate-video.ts

import type {
  VideoModelV1,
  GenerateVideoResult,
  GeneratedVideo,
  AspectRatio,
  ImageAsset,
} from './types';
import { normalizeImageAsset } from './utils';

export interface GenerateVideoParams {
  model: VideoModelV1;
  prompt: string;
  duration?: number;
  aspectRatio?: AspectRatio;
  seed?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface AnimateImageParams {
  model: VideoModelV1;
  image: ImageAsset;
  prompt?: string;
  duration?: number;
  aspectRatio?: AspectRatio;
  seed?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function generateVideo(
  params: GenerateVideoParams
): Promise<GenerateVideoResult> {
  const {
    model,
    prompt,
    duration,
    aspectRatio,
    seed,
    providerOptions = {},
    abortSignal,
  } = params;

  const modelProviderOptions = providerOptions[model.provider] ?? {};

  const result = await model.doGenerate({
    prompt,
    duration,
    aspectRatio,
    seed,
    providerOptions: modelProviderOptions,
    abortSignal,
  });

  const videos = result.videos.map((file) => createGeneratedVideo(file));

  return {
    videos,
    video: videos[0],
    warnings: result.warnings,
    response: result.response,
  };
}

export async function animateImage(
  params: AnimateImageParams
): Promise<GenerateVideoResult> {
  const {
    model,
    image,
    prompt,
    duration,
    aspectRatio,
    seed,
    providerOptions = {},
    abortSignal,
  } = params;

  const normalizedImage = await normalizeImageAsset(image);
  const modelProviderOptions = providerOptions[model.provider] ?? {};

  const result = await model.doGenerate({
    prompt,
    image: normalizedImage,
    duration,
    aspectRatio,
    seed,
    providerOptions: modelProviderOptions,
    abortSignal,
  });

  const videos = result.videos.map((file) => createGeneratedVideo(file));

  return {
    videos,
    video: videos[0],
    warnings: result.warnings,
    response: result.response,
  };
}

function createGeneratedVideo(file: {
  base64?: string;
  url?: string;
  uint8Array?: Uint8Array;
  mediaType: string;
}): GeneratedVideo {
  let base64 = file.base64 ?? '';
  let uint8Array = file.uint8Array ?? new Uint8Array();

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
