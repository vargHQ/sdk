/**
 * Text to TikTok Skill
 * Turn text into a TikTok with AI-generated looping background and voiceover
 */

import { z } from "zod";
import type { SkillDefinition } from "../../core/schema/types";

export const textToTiktokInputSchema = z.object({
  text: z.string().describe("Text content to convert to video"),
  voice: z
    .enum(["sam", "adam", "josh", "rachel"])
    .optional()
    .default("sam")
    .describe("Voice for narration"),
  backgroundPrompt: z
    .string()
    .optional()
    .default(
      "POV from inside moving car driving through rainy city at night, motion blur on streetlights, cinematic",
    )
    .describe("Prompt for background video"),
  captionStyle: z
    .enum(["default", "tiktok", "youtube"])
    .optional()
    .default("tiktok")
    .describe("Caption style"),
});

export const textToTiktokOutputSchema = z.object({
  videoUrl: z.string().describe("Final TikTok video URL"),
});

export type TextToTiktokInput = z.infer<typeof textToTiktokInputSchema>;
export type TextToTiktokOutput = z.infer<typeof textToTiktokOutputSchema>;

export const definition: SkillDefinition<
  typeof textToTiktokInputSchema,
  typeof textToTiktokOutputSchema
> = {
  type: "skill",
  name: "text-to-tiktok",
  description: "Turn text into a TikTok with looping background and voiceover",
  inputSchema: textToTiktokInputSchema,
  outputSchema: textToTiktokOutputSchema,
  steps: [
    {
      name: "generate-voiceover",
      run: "voice",
      inputs: {
        text: "$inputs.text",
        voice: "$inputs.voice",
        output: "output/voiceover.mp3",
      },
    },
    {
      name: "transcribe",
      run: "transcribe",
      inputs: {
        audio: "output/voiceover.mp3",
        provider: "fireworks",
        output: "output/captions.srt",
      },
    },
    {
      name: "generate-background-frame",
      run: "image",
      inputs: {
        prompt: "$inputs.backgroundPrompt",
        size: "portrait_16_9",
      },
    },
    {
      name: "generate-background-video",
      run: "video",
      inputs: {
        prompt: "$inputs.backgroundPrompt",
        image: "$results.generate-background-frame.imageUrl",
        duration: 10,
      },
    },
    {
      name: "add-captions",
      run: "captions",
      inputs: {
        video: "$results.generate-background-video.videoUrl",
        output: "output/final.mp4",
        srt: "output/captions.srt",
        style: "$inputs.captionStyle",
      },
    },
  ],
};

export default definition;
