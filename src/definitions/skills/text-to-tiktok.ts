/**
 * Text to TikTok Skill
 * Turn text into a TikTok with AI-generated looping background and voiceover
 */

import { z } from "zod";
import {
  captionStyleSchema,
  simpleVoiceSchema,
} from "../../core/schema/shared";
import type { SkillDefinition, ZodSchema } from "../../core/schema/types";

// Input schema with Zod
const textToTiktokInputSchema = z.object({
  text: z.string().describe("Text content to convert to video"),
  voice: simpleVoiceSchema.default("sam").describe("Voice for narration"),
  backgroundPrompt: z
    .string()
    .default(
      "POV from inside moving car driving through rainy city at night, motion blur on streetlights, cinematic",
    )
    .describe("Prompt for background video"),
  captionStyle: captionStyleSchema.default("tiktok").describe("Caption style"),
});

// Output schema with Zod
const textToTiktokOutputSchema = z.object({
  videoUrl: z.string(),
  voiceoverPath: z.string().optional(),
  captionsPath: z.string().optional(),
  backgroundVideoUrl: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof textToTiktokInputSchema,
  typeof textToTiktokOutputSchema
> = {
  input: textToTiktokInputSchema,
  output: textToTiktokOutputSchema,
};

export const definition: SkillDefinition<typeof schema> = {
  type: "skill",
  name: "text-to-tiktok",
  description: "Turn text into a TikTok with looping background and voiceover",
  schema,
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
