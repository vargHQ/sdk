import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { MusicModelV3 } from "./music-model";

export interface GenerateMusicOptions {
  model: MusicModelV3;
  prompt: string;
  duration?: number;
  seed?: number;
  providerOptions?: SharedV3ProviderOptions;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
}

export interface GenerateMusicResult {
  audio: {
    uint8Array: Uint8Array;
  };
  warnings: Array<{ type: string; feature?: string; details?: string }>;
  response: {
    timestamp: Date;
    modelId: string;
    headers: Record<string, string> | undefined;
  };
}

export async function generateMusic(
  options: GenerateMusicOptions,
): Promise<GenerateMusicResult> {
  const { model, prompt, duration, seed, providerOptions, abortSignal, headers } =
    options;

  const result = await model.doGenerate({
    prompt,
    duration,
    seed,
    providerOptions: providerOptions ?? {},
    abortSignal,
    headers,
  });

  return {
    audio: {
      uint8Array: result.audio,
    },
    warnings: result.warnings,
    response: result.response,
  };
}
