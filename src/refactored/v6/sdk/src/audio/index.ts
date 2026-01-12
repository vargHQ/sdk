// packages/sdk/src/audio/index.ts

import type {
  GenerateMusicParams,
  GenerateSpeechParams,
  GenerateSoundParams,
  AudioGenerateResult,
} from '../types';
import { createGeneratedFile } from '../providers';

export async function generateMusic(
  params: GenerateMusicParams
): Promise<AudioGenerateResult> {
  const { model, ...rest } = params;

  const result = await model.doGenerate({
    prompt: rest.prompt,
    duration: rest.duration,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const audios = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: audios,
    audios,
    audio: audios[0],
  };
}

export async function generateSpeech(
  params: GenerateSpeechParams
): Promise<AudioGenerateResult> {
  const { model, ...rest } = params;

  const result = await model.doGenerate({
    text: rest.text,
    voice: rest.voice,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const audios = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: audios,
    audios,
    audio: audios[0],
  };
}

export async function generateSound(
  params: GenerateSoundParams
): Promise<AudioGenerateResult> {
  const { model, ...rest } = params;

  const result = await model.doGenerate({
    prompt: rest.prompt,
    duration: rest.duration,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const audios = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: audios,
    audios,
    audio: audios[0],
  };
}
