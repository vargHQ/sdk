// packages/fal/src/fal-provider.ts

import type { ImageModelV1, VideoModelV1, AudioModelV1 } from '@varg/sdk';
import { createFalImageModel } from './fal-image-model';
import { createFalVideoModel } from './fal-video-model';
import { createFalAudioModel } from './fal-audio-model';

export interface FalProviderSettings {
  apiKey?: string;
  baseURL?: string;
}

export interface FalProvider {
  /**
   * Creates an image model for image generation.
   * @param modelId - The model ID (e.g., 'fal-ai/flux/schnell')
   */
  image(modelId: string): ImageModelV1;

  /**
   * Creates a video model for video generation.
   * @param modelId - The model ID (e.g., 'fal-ai/kling-video/v2/master')
   */
  video(modelId: string): VideoModelV1;

  /**
   * Creates an audio model for audio generation.
   * @param modelId - The model ID (e.g., 'fal-ai/mmaudio')
   */
  audio(modelId: string): AudioModelV1;
}

export function createFal(settings: FalProviderSettings = {}): FalProvider {
  const baseURL = settings.baseURL ?? 'https://queue.fal.run';

  const getHeaders = () => {
    const apiKey = settings.apiKey ?? process.env.FAL_KEY;
    if (!apiKey) {
      throw new Error(
        'FAL_KEY is required. Pass it in settings or set FAL_KEY env variable.'
      );
    }
    return {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    };
  };

  return {
    image(modelId: string): ImageModelV1 {
      return createFalImageModel({
        provider: 'fal',
        modelId,
        baseURL,
        headers: getHeaders,
      });
    },

    video(modelId: string): VideoModelV1 {
      return createFalVideoModel({
        provider: 'fal',
        modelId,
        baseURL,
        headers: getHeaders,
      });
    },

    audio(modelId: string): AudioModelV1 {
      return createFalAudioModel({
        provider: 'fal',
        modelId,
        baseURL,
        headers: getHeaders,
      });
    },
  };
}

/**
 * Default Fal provider instance.
 * Uses FAL_KEY environment variable for authentication.
 */
export const fal = createFal();
