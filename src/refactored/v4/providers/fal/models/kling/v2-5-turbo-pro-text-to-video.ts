export interface TextToVideoParams {
  prompt: string;
  duration?: "5" | "10";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  cfg_scale?: number;
}

export async function serialize(params: VideoParams);

export async function run(params: TextToVideoParams) {
  const endpoint = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";

  const falParams = {
    prompt: params.prompt,
    duration: params.duration || "5",
    aspect_ratio: params.aspect_ratio || "16:9",
    negative_prompt: params.negative_prompt || "blur, distort, and low quality",
    cfg_scale: params.cfg_scale ?? 0.5,
  };

  const result = await falRun(endpoint, falParams);

  return {
    output: result.video.url,
    metadata: {
      duration: parseInt(params.duration || "5"),
      aspect_ratio: params.aspect_ratio || "16:9",
    },
  };
}
