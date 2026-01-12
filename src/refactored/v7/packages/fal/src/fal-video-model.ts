// packages/fal/src/fal-video-model.ts

import type {
  VideoModelV1,
  VideoModelParams,
  VideoModelResult,
} from '@varg/sdk';

export interface FalVideoModelConfig {
  provider: string;
  modelId: string;
  baseURL: string;
  headers: () => Record<string, string>;
}

export function createFalVideoModel(config: FalVideoModelConfig): VideoModelV1 {
  return {
    specificationVersion: 'v1',
    provider: config.provider,
    modelId: config.modelId,
    type: 'video',

    async doGenerate(params: VideoModelParams): Promise<VideoModelResult> {
      const body = {
        prompt: params.prompt,
        image_url: params.image,
        video_url: params.video,
        duration: params.duration,
        aspect_ratio: params.aspectRatio,
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
      const result = await pollForResult<FalVideoResponse>(
        config.baseURL,
        config.modelId,
        request_id,
        config.headers,
        params.abortSignal
      );

      return {
        videos: result.video
          ? [{ url: result.video.url, mediaType: 'video/mp4' }]
          : [],
        response: {
          timestamp: new Date(),
          modelId: config.modelId,
        },
      };
    },
  };
}

interface FalVideoResponse {
  video?: { url: string };
}

async function pollForResult<T>(
  baseURL: string,
  modelId: string,
  requestId: string,
  headers: () => Record<string, string>,
  abortSignal?: AbortSignal,
  maxAttempts = 300 // 5 minutes for video
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
