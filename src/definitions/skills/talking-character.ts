/**
 * Talking Character Skill
 * Create a talking character video with lipsync and captions
 */

import type { SkillDefinition } from "../../core/schema/types";

export const definition: SkillDefinition = {
  type: "skill",
  name: "talking-character",
  description: "Create a talking character video with lipsync and captions",
  schema: {
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: {
          type: "string",
          description: "Script/text for the character to say",
        },
        characterPrompt: {
          type: "string",
          default:
            "professional headshot of a friendly person, studio lighting",
          description: "Prompt to generate the character",
        },
        voice: {
          type: "string",
          enum: ["rachel", "sam", "adam", "josh"],
          default: "sam",
          description: "Voice to use for speech",
        },
        duration: {
          type: "integer",
          enum: [5, 10],
          default: 5,
          description: "Video duration",
        },
        style: {
          type: "string",
          enum: ["default", "tiktok", "youtube"],
          default: "tiktok",
          description: "Caption style",
        },
      },
    },
    output: {
      type: "object",
      description: "Final video with character, voice, and captions",
    },
  },
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
