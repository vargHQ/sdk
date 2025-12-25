/**
 * Talking Character Skill
 * Create a talking character video with lipsync and captions
 */

import { z } from "zod";
import {
  captionStyleSchema,
  simpleVoiceSchema,
  videoDurationSchema,
} from "../../core/schema/shared";
import type { SkillDefinition, ZodSchema } from "../../core/schema/types";

// Input schema with Zod
const talkingCharacterInputSchema = z.object({
  text: z.string().describe("Script/text for the character to say"),
  characterPrompt: z
    .string()
    .default("professional headshot of a friendly person, studio lighting")
    .describe("Prompt to generate the character"),
  voice: simpleVoiceSchema.default("sam").describe("Voice to use for speech"),
  duration: videoDurationSchema.default(5).describe("Video duration"),
  style: captionStyleSchema.default("tiktok").describe("Caption style"),
});

// Output schema with Zod
const talkingCharacterOutputSchema = z.object({
  videoUrl: z.string(),
  characterImageUrl: z.string().optional(),
  audioPath: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof talkingCharacterInputSchema,
  typeof talkingCharacterOutputSchema
> = {
  input: talkingCharacterInputSchema,
  output: talkingCharacterOutputSchema,
};

export const definition: SkillDefinition<typeof schema> = {
  type: "skill",
  name: "talking-character",
  description: "Create a talking character video with lipsync and captions",
  schema,
  steps: [
    {
      name: "generate-character",
      run: "image",
      inputs: {
        prompt: "$inputs.characterPrompt",
        provider: "higgsfield",
      },
    },
    {
      name: "generate-voice",
      run: "voice",
      inputs: {
        text: "$inputs.text",
        voice: "$inputs.voice",
        output: "output/voiceover.mp3",
      },
    },
    {
      name: "animate-character",
      run: "sync",
      inputs: {
        image: "$results.generate-character.imageUrl",
        audio: "output/voiceover.mp3",
        prompt: "person talking naturally, professional demeanor",
        duration: "$inputs.duration",
      },
    },
    {
      name: "add-captions",
      run: "captions",
      inputs: {
        video: "$results.animate-character.videoUrl",
        output: "output/final.mp4",
        style: "$inputs.style",
      },
    },
  ],
};

export default definition;
