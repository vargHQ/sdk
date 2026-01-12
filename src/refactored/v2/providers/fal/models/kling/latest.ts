// provider/fal/adapters/kling/latest.ts
import * as imageToVideo from "./versions/v2-5-turbo-pro-image-to-video";
import type { ImageToVideoParams } from "./versions/v2-5-turbo-pro-image-to-video";
import type { TextToVideoParams } from "./versions/v2-5-turbo-pro-text-to-video";
import * as textToVideo from "./versions/v2-5-turbo-pro-text-to-video";

export interface KlingParams {
  prompt: string;
  image?: string;
  duration?: "5" | "10";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  cfg_scale?: number;
}

export async function run(params: KlingParams) {
  // Route based on capability
  if (params.image) {
    return imageToVideo.run(params as ImageToVideoParams);
  }

  return textToVideo.run(params as TextToVideoParams);
}
