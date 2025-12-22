/**
 * Talking Character Skill
 * Create a talking character video with lipsync and captions
 */

import { z } from "zod";
import type { SkillDefinition } from "../../core/schema/types";

export const talkingCharacterInputSchema = z.object({
  text: z.string().describe("Script/text for the character to say"),
  characterPrompt: z
    .string()
    .default("professional headshot of a friendly person, studio lighting")
    .describe("Prompt to generate the character"),
  voice: z
    .enum(["rachel", "sam", "adam", "josh"])
    .default("sam")
    .describe("Voice to use for speech"),
  duration: z
    .union([z.literal(5), z.literal(10)])
    .default(5)
    .describe("Video duration"),
  style: z
    .enum(["default", "tiktok", "youtube"])
    .default("tiktok")
    .describe("Caption style"),
});

export const talkingCharacterOutputSchema = z.object({
  videoUrl: z
    .string()
    .describe("Final video URL with character, voice, and captions"),
});

export type TalkingCharacterInput = z.infer<typeof talkingCharacterInputSchema>;
export type TalkingCharacterOutput = z.infer<
  typeof talkingCharacterOutputSchema
>;

export const definition: SkillDefinition<
  typeof talkingCharacterInputSchema,
  typeof talkingCharacterOutputSchema
> = {
  type: "skill",
  name: "talking-character",
  description: "Create a talking character video with lipsync and captions",
  inputSchema: talkingCharacterInputSchema,
  outputSchema: talkingCharacterOutputSchema,
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
