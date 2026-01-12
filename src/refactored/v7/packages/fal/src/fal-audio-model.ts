// packages/fal/src/fal-audio-model.ts

import type {
  AudioModelV1,
  AudioModelParams,
  AudioModelResult,
} from '@varg/sdk';

export interface FalAudioModelConfig {
  provider: string;
  modelId: string;
  baseURL: string;
  headers: () => Record<string, string>;
}

export function createFalAudioModel(config: FalAudioModelConfig): AudioModelV1 {
  return {
    specificationVersion: 'v1',
    provider: config.provider,
    modelId: config.modelId,
    type: 'audio',

    async doGenerate(params: AudioModelParams): Promise<AudioModelResult> {
      const body = {
        prompt: params.prompt,
        text: params.text,
        voice: params.voice,
        video_url: params.video,
        duration: params.duration,
        seed: params.seed,
        ...params.providerOptions,
      };

      // Submit to queue
      const submitResponse = await fetch(`${config.baseURL}/${config.modelId}`, {
        method: 'POST',
        headers: config.headers(),
        body: JSON.stringify(body),
        signal: params.abortSignal,
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.text();
        throw new Error(`Fal request failed: ${submitResponse.status} ${error}`);
      }

      const { request_id } = (await submitResponse.json()) as { request_id: string };

      // Poll for result
      const result = await pollForResult<FalAudioResponse>(
        config.baseURL,
        config.modelId,
        request_id,
        config.headers,
        params.abortSignal
      );

      return {
        audios: result.audio
          ? [{ url: result.audio.url, mediaType: 'audio/mp3' }]
          : [],
        response: {
          timestamp: new Date(),
          modelId: config.modelId,
        },
      };
    },
  };
}

interface FalAudioResponse {
  audio?: { url: string };
}

async function pollForResult<T>(
  baseURL: string,
  modelId: string,
  requestId: string,
  headers: () => Record<string, string>,
  abortSignal?: AbortSignal,
  maxAttempts = 180
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `${baseURL}/${modelId}/requests/${requestId}`,
      { headers: headers(), signal: abortSignal }
    );

    if (!response.ok) {
      throw new Error(`Poll failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      status: string;
      result?: T;
      error?: string;
    };

    if (data.status === 'completed') {
      return data.result as T;
    }

    if (data.status === 'failed') {
      throw new Error(data.error ?? 'Generation failed');
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error('Timeout waiting for result');
}
