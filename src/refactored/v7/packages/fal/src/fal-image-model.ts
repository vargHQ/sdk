// packages/fal/src/fal-image-model.ts

import type {
  ImageModelV1,
  ImageModelParams,
  ImageModelResult,
} from '@varg/sdk';

export interface FalImageModelConfig {
  provider: string;
  modelId: string;
  baseURL: string;
  headers: () => Record<string, string>;
}

export function createFalImageModel(config: FalImageModelConfig): ImageModelV1 {
  return {
    specificationVersion: 'v1',
    provider: config.provider,
    modelId: config.modelId,
    type: 'image',

    async doGenerate(params: ImageModelParams): Promise<ImageModelResult> {
      const body = {
        prompt: params.prompt,
        num_images: params.n,
        image_size: params.size ?? params.aspectRatio,
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
      const result = await pollForResult<FalImageResponse>(
        config.baseURL,
        config.modelId,
        request_id,
        config.headers,
        params.abortSignal
      );

      return {
        images: (result.images ?? []).map((img) => ({
          url: img.url,
          mediaType: 'image/png',
        })),
        response: {
          timestamp: new Date(),
          modelId: config.modelId,
        },
      };
    },
  };
}

interface FalImageResponse {
  images?: Array<{ url: string }>;
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
