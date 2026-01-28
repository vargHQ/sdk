/**
 * Shared Zod schemas for reuse across definitions
 * These schemas represent common patterns used in multiple models/actions/skills
 */

import { z } from "zod";

// Video aspect ratios
export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

// Video duration in seconds (number version)
export const videoDurationSchema = z.union([z.literal(5), z.literal(10)]);
export type VideoDuration = z.infer<typeof videoDurationSchema>;

// Video duration as string (for models that expect string)
export const videoDurationStringSchema = z.enum(["5", "10"]);
export type VideoDurationString = z.infer<typeof videoDurationStringSchema>;

// Video resolution
export const resolutionSchema = z.enum(["480p", "720p", "1080p"]);
export type Resolution = z.infer<typeof resolutionSchema>;

// ElevenLabs preset voices
export const voiceNameSchema = z.enum([
  "rachel",
  "domi",
  "bella",
  "antoni",
  "josh",
  "adam",
  "sam",
]);
export type VoiceName = z.infer<typeof voiceNameSchema>;

// Simplified voice set (commonly used in skills)
export const simpleVoiceSchema = z.enum(["rachel", "sam", "adam", "josh"]);
export type SimpleVoice = z.infer<typeof simpleVoiceSchema>;

// Caption styles
export const captionStyleSchema = z.enum(["default", "tiktok", "youtube"]);
export type CaptionStyle = z.infer<typeof captionStyleSchema>;

// Audio output formats
export const audioFormatSchema = z.enum(["mp3", "wav", "flac", "ogg", "m4a"]);
export type AudioFormat = z.infer<typeof audioFormatSchema>;

// Flux image sizes
export const imageSizeSchema = z.enum([
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
]);
export type ImageSize = z.infer<typeof imageSizeSchema>;

// Soul character quality
export const soulQualitySchema = z.enum(["SD", "HD", "UHD"]);
export type SoulQuality = z.infer<typeof soulQualitySchema>;

// ElevenLabs TTS model IDs
export const elevenLabsModelSchema = z.enum([
  "eleven_multilingual_v2",
  "eleven_monolingual_v1",
  "eleven_turbo_v2",
]);
export type ElevenLabsModel = z.infer<typeof elevenLabsModelSchema>;

// Transcription providers
export const transcriptionProviderSchema = z.enum(["groq", "fireworks"]);
export type TranscriptionProvider = z.infer<typeof transcriptionProviderSchema>;

// Provider name choices
export const providerNameSchema = z.enum([
  "fal",
  "replicate",
  "elevenlabs",
  "higgsfield",
  "groq",
  "fireworks",
  "decart",
]);
export type ProviderName = z.infer<typeof providerNameSchema>;

// Common format validators
export const filePathSchema = z.string().min(1, "File path cannot be empty");
export const urlSchema = z.string().url("Must be a valid URL");
export const uriSchema = z
  .string()
  .refine(
    (val) =>
      val.startsWith("http://") ||
      val.startsWith("https://") ||
      val.startsWith("file://") ||
      val.startsWith("/"),
    "Must be a URL or absolute path",
  );

// Number range helpers
export const percentSchema = z.number().min(0).max(1);
export const positiveIntSchema = z.number().int().positive();
