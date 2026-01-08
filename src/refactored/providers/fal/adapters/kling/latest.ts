// provider/fal/adapters/kling/latest.ts
import * as imageToVideo from "./versions/v2-5-turbo-pro-image-to-video";
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
    return imageToVideo.run({
      prompt: params.prompt,
      image_url: params.image,
      duration: params.duration,
      negative_prompt: params.negative_prompt,
      cfg_scale: params.cfg_scale,
    });
  }

  return textToVideo.run({
    prompt: params.prompt,
    duration: params.duration,
    aspect_ratio: params.aspect_ratio,
    negative_prompt: params.negative_prompt,
    cfg_scale: params.cfg_scale,
  });
}
