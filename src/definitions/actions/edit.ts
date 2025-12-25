/**
 * Video editing actions
 * FFmpeg-based local video processing
 */

import { z } from "zod";
import { filePathSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { ffmpegProvider } from "../../providers/ffmpeg";

// ============================================================================
// Trim action
// ============================================================================

const trimInputSchema = z.object({
  input: filePathSchema.describe("Input video"),
  output: filePathSchema.describe("Output path"),
  start: z.number().describe("Start time in seconds"),
  duration: z.number().optional().describe("Duration in seconds"),
});

const trimOutputSchema = z.string().describe("Trimmed video path");

const trimSchema: ZodSchema<typeof trimInputSchema, typeof trimOutputSchema> = {
  input: trimInputSchema,
  output: trimOutputSchema,
};

export const trimDefinition: ActionDefinition<typeof trimSchema> = {
  type: "action",
  name: "trim",
  description: "Trim video to specific time range",
  schema: trimSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, output, start, duration } = inputs;
    return ffmpegProvider.trimVideo({ input, output, start, duration });
  },
};

// ============================================================================
// Cut action (alias for trim)
// ============================================================================

export const cutDefinition: ActionDefinition<typeof trimSchema> = {
  type: "action",
  name: "cut",
  description: "Cut video at specific point",
  schema: trimSchema,
  routes: [{ target: "trim" }],
};

// ============================================================================
// Merge action
// ============================================================================

const mergeInputSchema = z.object({
  inputs: z.array(z.string()).describe("Input video paths"),
  output: filePathSchema.describe("Output path"),
});

const mergeOutputSchema = z.string().describe("Merged video path");

const mergeSchema: ZodSchema<
  typeof mergeInputSchema,
  typeof mergeOutputSchema
> = {
  input: mergeInputSchema,
  output: mergeOutputSchema,
};

export const mergeDefinition: ActionDefinition<typeof mergeSchema> = {
  type: "action",
  name: "merge",
  description: "Merge multiple videos together",
  schema: mergeSchema,
  routes: [],
  execute: async (inputs) => {
    const { inputs: videoInputs, output } = inputs;
    return ffmpegProvider.concatVideos({ inputs: videoInputs, output });
  },
};

// ============================================================================
// Split action
// ============================================================================

const splitInputSchema = z.object({
  input: filePathSchema.describe("Input video"),
  timestamps: z.array(z.number()).describe("Split points in seconds"),
  outputPrefix: z.string().describe("Output filename prefix"),
});

// Output is an array of output paths
const splitOutputSchema = z.array(z.string());

const splitSchema: ZodSchema<
  typeof splitInputSchema,
  typeof splitOutputSchema
> = {
  input: splitInputSchema,
  output: splitOutputSchema,
};

export const splitDefinition: ActionDefinition<typeof splitSchema> = {
  type: "action",
  name: "split",
  description: "Split video at timestamps",
  schema: splitSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, timestamps, outputPrefix } = inputs;
    return ffmpegProvider.splitAtTimestamps({
      input,
      timestamps,
      outputPrefix,
    });
  },
};

// ============================================================================
// Fade action
// ============================================================================

const fadeInputSchema = z.object({
  input: filePathSchema.describe("Input video"),
  output: filePathSchema.describe("Output path"),
  type: z.enum(["in", "out", "both"]).describe("Fade type"),
  duration: z.number().describe("Fade duration in seconds"),
});

const fadeOutputSchema = z.string().describe("Faded video path");

const fadeSchema: ZodSchema<typeof fadeInputSchema, typeof fadeOutputSchema> = {
  input: fadeInputSchema,
  output: fadeOutputSchema,
};

export const fadeDefinition: ActionDefinition<typeof fadeSchema> = {
  type: "action",
  name: "fade",
  description: "Apply fade in/out effects",
  schema: fadeSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, output, type, duration } = inputs;
    return ffmpegProvider.fadeVideo({ input, output, type, duration });
  },
};

// ============================================================================
// Transition action
// ============================================================================

const transitionInputSchema = z.object({
  input1: filePathSchema.describe("First video"),
  input2: filePathSchema.describe("Second video"),
  output: filePathSchema.describe("Output path"),
  transition: z
    .enum([
      "crossfade",
      "dissolve",
      "wipeleft",
      "wiperight",
      "slideup",
      "slidedown",
    ])
    .describe("Transition type"),
  duration: z.number().describe("Transition duration"),
  fit: z
    .enum(["pad", "crop", "blur", "stretch"])
    .default("pad")
    .describe("How to handle different resolutions"),
});

const transitionOutputSchema = z.string().describe("Output path");

const transitionSchema: ZodSchema<
  typeof transitionInputSchema,
  typeof transitionOutputSchema
> = {
  input: transitionInputSchema,
  output: transitionOutputSchema,
};

export const transitionDefinition: ActionDefinition<typeof transitionSchema> = {
  type: "action",
  name: "transition",
  description: "Apply transition between two videos",
  schema: transitionSchema,
  routes: [],
  execute: async (inputs) => {
    const { input1, input2, output, transition, duration, fit } = inputs;
    return ffmpegProvider.xfadeVideos({
      input1,
      input2,
      output,
      transition,
      duration,
      fit,
    });
  },
};

// ============================================================================
// Remove (audio) action
// ============================================================================

const removeInputSchema = z.object({
  input: filePathSchema.describe("Input video"),
  output: filePathSchema.describe("Output path"),
  what: z
    .enum(["audio", "video"])
    .default("audio")
    .describe("What to extract/remove"),
});

const removeOutputSchema = z.string().describe("Output path");

const removeSchema: ZodSchema<
  typeof removeInputSchema,
  typeof removeOutputSchema
> = {
  input: removeInputSchema,
  output: removeOutputSchema,
};

export const removeDefinition: ActionDefinition<typeof removeSchema> = {
  type: "action",
  name: "remove",
  description: "Remove audio from video or extract audio",
  schema: removeSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, output, what } = inputs;

    if (what === "audio") {
      return ffmpegProvider.extractAudio(input, output);
    }

    // Extract video (remove audio)
    return ffmpegProvider.convertFormat({ input, output });
  },
};

// Export all definitions
export const definitions = [
  trimDefinition,
  cutDefinition,
  mergeDefinition,
  splitDefinition,
  fadeDefinition,
  transitionDefinition,
  removeDefinition,
];

// Re-export types for backward compatibility
export type TrimOptions = Parameters<typeof ffmpegProvider.trimVideo>[0];
export type TrimResult = Awaited<ReturnType<typeof ffmpegProvider.trimVideo>>;
export type CutOptions = TrimOptions;
export type CutResult = TrimResult;
export type MergeOptions = Parameters<typeof ffmpegProvider.concatVideos>[0];
export type MergeResult = Awaited<
  ReturnType<typeof ffmpegProvider.concatVideos>
>;
export type SplitOptions = Parameters<
  typeof ffmpegProvider.splitAtTimestamps
>[0];
export type SplitResult = Awaited<
  ReturnType<typeof ffmpegProvider.splitAtTimestamps>
>;
export type FadeOptions = Parameters<typeof ffmpegProvider.fadeVideo>[0];
export type FadeResult = Awaited<ReturnType<typeof ffmpegProvider.fadeVideo>>;
export type TransitionOptions = Parameters<
  typeof ffmpegProvider.xfadeVideos
>[0];
export type TransitionResult = Awaited<
  ReturnType<typeof ffmpegProvider.xfadeVideos>
>;
export type RemoveOptions = {
  input: string;
  output: string;
  what?: "audio" | "video";
};
export type RemoveResult = string;

// Convenience exports
export const trim = (opts: TrimOptions) => ffmpegProvider.trimVideo(opts);
export const cut = trim;
export const merge = (opts: MergeOptions) => ffmpegProvider.concatVideos(opts);
export const split = (opts: SplitOptions) =>
  ffmpegProvider.splitAtTimestamps(opts);
export const fade = (opts: FadeOptions) => ffmpegProvider.fadeVideo(opts);
export const transition = (opts: TransitionOptions) =>
  ffmpegProvider.xfadeVideos(opts);
export const remove = removeDefinition.execute;

export default trimDefinition;
