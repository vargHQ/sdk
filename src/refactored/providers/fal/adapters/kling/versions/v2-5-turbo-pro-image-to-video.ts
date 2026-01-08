import { run as falRun } from "../../../client";

export interface ImageToVideoParams {
  prompt: string;
  image_url: string;
  duration?: "5" | "10";
  negative_prompt?: string;
  cfg_scale?: number;
  tail_image_url?: string;
}

export async function run(params: ImageToVideoParams) {
  const endpoint = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";

  const falParams = {
    prompt: params.prompt,
    image_url: params.image_url,
    duration: params.duration || "5",
    negative_prompt: params.negative_prompt || "blur, distort, and low quality",
    cfg_scale: params.cfg_scale ?? 0.5,
    ...(params.tail_image_url && { tail_image_url: params.tail_image_url }),
  };

  const result = await falRun(endpoint, falParams);

  return {
    output: result.video.url,
    metadata: {
      duration: parseInt(params.duration || "5"),
    },
  };
}
