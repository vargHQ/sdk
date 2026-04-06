/**
 * HeyGen avatar video model
 *
 * Two modes:
 * 1. Image-to-lipsync (POST /v2/videos): image + audio/script → talking video
 *    - Uses image_url or image passed via prompt.images
 *    - Audio from ElevenLabs via prompt.audio, or script+voice_id for HeyGen TTS
 *    - Supports motion_prompt, expressiveness, remove_background
 *
 * 2. Pre-registered avatar (POST /v2/video/generate, Studio V2):
 *    - Uses avatar_id from HeyGen's catalog
 *    - script + voice_id for TTS
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

const heygenInputSchema = z.object({
  script: z
    .string()
    .optional()
    .describe(
      "Script text for the avatar to speak (used with voice_id for HeyGen TTS, or omit when providing audio)",
    ),
  voice_id: z
    .string()
    .optional()
    .describe("HeyGen voice ID (required when using script, not needed with audio)"),
  avatar_id: z
    .string()
    .optional()
    .describe("Pre-registered HeyGen avatar ID (mutually exclusive with image_url)"),
  image_url: z
    .string()
    .optional()
    .describe(
      "Public URL of image to animate (mutually exclusive with avatar_id). Can also pass image via prompt.images",
    ),
  audio_url: z
    .string()
    .optional()
    .describe(
      "Public URL of audio file for lipsync (mutually exclusive with script). Can also pass audio via prompt.audio",
    ),
  motion_prompt: z
    .string()
    .optional()
    .describe(
      "Natural language prompt controlling avatar body motion (e.g. 'natural gestures, expressive')",
    ),
  expressiveness: z
    .enum(["low", "medium", "high"])
    .optional()
    .default("medium")
    .describe("Avatar expressiveness level"),
  aspect_ratio: z
    .enum(["16:9", "9:16"])
    .optional()
    .default("16:9")
    .describe("Video aspect ratio"),
  resolution: z
    .enum(["720p", "1080p"])
    .optional()
    .default("1080p")
    .describe("Video resolution"),
  remove_background: z
    .boolean()
    .optional()
    .default(false)
    .describe("Remove the avatar background"),
});

const heygenOutputSchema = z.object({
  videoUrl: z.string(),
  duration: z.number().optional(),
});

const schema: ZodSchema<typeof heygenInputSchema, typeof heygenOutputSchema> = {
  input: heygenInputSchema,
  output: heygenOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "heygen-avatar",
  description:
    "HeyGen Avatar IV — image-to-lipsync and pre-registered avatar video generation. " +
    "Supports ElevenLabs audio input for lipsync or HeyGen's built-in TTS.",
  providers: ["heygen"],
  defaultProvider: "heygen",
  providerModels: {
    heygen: "avatar-iv",
  },
  schema,
};

export default definition;
