/**
 * Text to TikTok Skill
 * Turn text into a TikTok with AI-generated looping background and voiceover
 */

import type { SkillDefinition } from "../../core/schema/types";

export const definition: SkillDefinition = {
  type: "skill",
  name: "text-to-tiktok",
  description: "Turn text into a TikTok with looping background and voiceover",
  schema: {
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: {
          type: "string",
          description: "Text content to convert to video",
        },
        voice: {
          type: "string",
          enum: ["sam", "adam", "josh", "rachel"],
          default: "sam",
          description: "Voice for narration",
        },
        backgroundPrompt: {
          type: "string",
          default:
            "POV from inside moving car driving through rainy city at night, motion blur on streetlights, cinematic",
          description: "Prompt for background video",
        },
        captionStyle: {
          type: "string",
          enum: ["default", "tiktok", "youtube"],
          default: "tiktok",
          description: "Caption style",
        },
      },
    },
    output: {
      type: "object",
      description: "Final TikTok video",
    },
  },
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
