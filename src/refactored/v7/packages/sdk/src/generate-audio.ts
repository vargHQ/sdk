// packages/sdk/src/generate-audio.ts

import type {
  AudioModelV1,
  GenerateAudioResult,
  GeneratedAudio,
  VideoAsset,
} from './types';
import { normalizeVideoAsset } from './utils';

export interface GenerateMusicParams {
  model: AudioModelV1;
  prompt: string;
  duration?: number;
  seed?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
  abortSignal?: AbortSignal;
}

export interface GenerateSpeechParams {
  model: AudioModelV1;
  text: string;
  voice?: string;
  seed?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
  abortSignal?: AbortSignal;
}

export interface GenerateSoundParams {
  model: AudioModelV1;
  prompt: string;
  video?: VideoAsset;
  duration?: number;
  seed?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
  abortSignal?: AbortSignal;
}

export async function generateMusic(
  params: GenerateMusicParams
): Promise<GenerateAudioResult> {
  const {
    model,
    prompt,
    duration,
    seed,
    providerOptions = {},
    abortSignal,
  } = params;

  const modelProviderOptions = providerOptions[model.provider] ?? {};

  const result = await model.doGenerate({
    prompt,
    duration,
    seed,
    providerOptions: modelProviderOptions,
    abortSignal,
  });

  const audios = result.audios.map((file) => createGeneratedAudio(file));

  return {
    audios,
    audio: audios[0],
    warnings: result.warnings,
    response: result.response,
  };
}

export async function generateSpeech(
  params: GenerateSpeechParams
): Promise<GenerateAudioResult> {
  const {
    model,
    text,
    voice,
    seed,
    providerOptions = {},
    abortSignal,
  } = params;

  const modelProviderOptions = providerOptions[model.provider] ?? {};

  const result = await model.doGenerate({
    text,
    voice,
    seed,
    providerOptions: modelProviderOptions,
    abortSignal,
  });

  const audios = result.audios.map((file) => createGeneratedAudio(file));

  return {
    audios,
    audio: audios[0],
    warnings: result.warnings,
    response: result.response,
  };
}

export async function generateSound(
  params: GenerateSoundParams
): Promise<GenerateAudioResult> {
  const {
    model,
    prompt,
    video,
    duration,
    seed,
    providerOptions = {},
    abortSignal,
  } = params;

  const normalizedVideo = video ? await normalizeVideoAsset(video) : undefined;
  const modelProviderOptions = providerOptions[model.provider] ?? {};

  const result = await model.doGenerate({
    prompt,
    video: normalizedVideo,
    duration,
    seed,
    providerOptions: modelProviderOptions,
    abortSignal,
  });

  const audios = result.audios.map((file) => createGeneratedAudio(file));

  return {
    audios,
    audio: audios[0],
    warnings: result.warnings,
    response: result.response,
  };
}

function createGeneratedAudio(file: {
  base64?: string;
  url?: string;
  uint8Array?: Uint8Array;
  mediaType: string;
}): GeneratedAudio {
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
