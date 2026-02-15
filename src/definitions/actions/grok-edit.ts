/**
 * Grok Imagine Video Edit action
 * Edit videos using xAI's Grok Imagine Video model
 */

import { fal } from "@fal-ai/client";
import { z } from "zod";
import { filePathSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { ensureUrl, logQueueUpdate } from "./utils";

// Resolution enum matching the API spec
const grokEditResolutionSchema = z
  .enum(["auto", "480p", "720p"])
  .default("auto")
  .describe("Resolution of the output video");

// Input schema with Zod
const grokEditInputSchema = z.object({
  prompt: z.string().describe("Text description of the desired edit"),
  video: filePathSchema.describe(
    "Input video to edit (will be resized to max 854x480 and truncated to 8 seconds)",
  ),
  resolution: grokEditResolutionSchema,
});

// Output schema with Zod
const grokEditOutputSchema = z.object({
  videoUrl: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  fps: z.number().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof grokEditInputSchema,
  typeof grokEditOutputSchema
> = {
  input: grokEditInputSchema,
  output: grokEditOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "grok-edit",
  description: "Edit video using xAI's Grok Imagine Video",
  schema,
  routes: [
    {
      target: "xai/grok-imagine-video/edit-video",
      priority: 10,
    },
  ],
  execute: async (inputs) => {
    const { prompt, video, resolution } = inputs;

    console.log("[action/grok-edit] editing video with Grok Imagine");

    const inputUrl = await ensureUrl(video);
    const result = await fal.subscribe("xai/grok-imagine-video/edit-video", {
      input: {
        prompt,
        video_url: inputUrl,
        resolution: resolution ?? "auto",
      },
      logs: true,
      onQueueUpdate: logQueueUpdate("grok-edit"),
    });

    const data = result.data as {
      video?: {
        url?: string;
        width?: number;
        height?: number;
        duration?: number;
        fps?: number;
      };
    };

    const videoUrl = data?.video?.url;
    if (!videoUrl) {
      throw new Error("No video URL in result");
    }

    return {
      videoUrl,
      width: data.video?.width,
      height: data.video?.height,
      duration: data.video?.duration,
      fps: data.video?.fps,
    };
  },
};

// Re-export types for convenience
export type GrokEditInput = z.infer<typeof grokEditInputSchema>;
export type GrokEditOutput = z.infer<typeof grokEditOutputSchema>;

// Convenience function
export async function grokEditVideo(
  prompt: string,
  videoUrl: string,
  options: { resolution?: "auto" | "480p" | "720p" } = {},
): Promise<GrokEditOutput> {
  console.log("[grok-edit] editing video");

  const inputUrl = await ensureUrl(videoUrl);
  const result = await fal.subscribe("xai/grok-imagine-video/edit-video", {
    input: {
      prompt,
      video_url: inputUrl,
      resolution: options.resolution ?? "auto",
    },
    logs: true,
    onQueueUpdate: logQueueUpdate("grok-edit"),
  });

  const data = result.data as {
    video?: {
      url?: string;
      width?: number;
      height?: number;
      duration?: number;
      fps?: number;
    };
  };

  const resultUrl = data?.video?.url;
  if (!resultUrl) {
    throw new Error("No video URL in result");
  }

  return {
    videoUrl: resultUrl,
    width: data.video?.width,
    height: data.video?.height,
    duration: data.video?.duration,
    fps: data.video?.fps,
  };
}

export default definition;
