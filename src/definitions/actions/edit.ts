/**
 * Video editing actions
 * FFmpeg-based local video processing
 */

import { z } from "zod";
import type { ActionDefinition } from "../../core/schema/types";
import { ffmpegProvider } from "../../providers/ffmpeg";

// === TRIM ===
export const trimInputSchema = z.object({
  input: z.string().describe("Input video"),
  output: z.string().describe("Output path"),
  start: z.number().describe("Start time in seconds"),
  duration: z.number().optional().describe("Duration in seconds"),
});

export const trimOutputSchema = z.string().describe("Trimmed video path");

export type TrimInput = z.infer<typeof trimInputSchema>;
export type TrimOutput = z.infer<typeof trimOutputSchema>;

export const trimDefinition: ActionDefinition<
  typeof trimInputSchema,
  typeof trimOutputSchema
> = {
  type: "action",
  name: "trim",
  description: "Trim video to specific time range",
  inputSchema: trimInputSchema,
  outputSchema: trimOutputSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, output, start, duration } = inputs;
    return ffmpegProvider.trimVideo({ input, output, start, duration });
  },
};

// === CUT (alias for trim) ===
export const cutInputSchema = trimInputSchema;
export const cutOutputSchema = trimOutputSchema;

export type CutInput = TrimInput;
export type CutOutput = TrimOutput;

export const cutDefinition: ActionDefinition<
  typeof cutInputSchema,
  typeof cutOutputSchema
> = {
  type: "action",
  name: "cut",
  description: "Cut video at specific point",
  inputSchema: cutInputSchema,
  outputSchema: cutOutputSchema,
  routes: [{ target: "trim" }],
};

// === MERGE ===
export const mergeInputSchema = z.object({
  inputs: z.array(z.string()).describe("Input video paths"),
  output: z.string().describe("Output path"),
});

export const mergeOutputSchema = z.string().describe("Merged video path");

export type MergeInput = z.infer<typeof mergeInputSchema>;
export type MergeOutput = z.infer<typeof mergeOutputSchema>;

export const mergeDefinition: ActionDefinition<
  typeof mergeInputSchema,
  typeof mergeOutputSchema
> = {
  type: "action",
  name: "merge",
  description: "Merge multiple videos together",
  inputSchema: mergeInputSchema,
  outputSchema: mergeOutputSchema,
  routes: [],
  execute: async (inputs) => {
    const { inputs: videoInputs, output } = inputs;
    return ffmpegProvider.concatVideos({ inputs: videoInputs, output });
  },
};

// === SPLIT ===
export const splitInputSchema = z.object({
  input: z.string().describe("Input video"),
  timestamps: z.array(z.number()).describe("Split points in seconds"),
  outputPrefix: z.string().describe("Output filename prefix"),
});

export const splitOutputSchema = z
  .array(z.string())
  .describe("Output paths array");

export type SplitInput = z.infer<typeof splitInputSchema>;
export type SplitOutput = z.infer<typeof splitOutputSchema>;

export const splitDefinition: ActionDefinition<
  typeof splitInputSchema,
  typeof splitOutputSchema
> = {
  type: "action",
  name: "split",
  description: "Split video at timestamps",
  inputSchema: splitInputSchema,
  outputSchema: splitOutputSchema,
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

// === FADE ===
export const fadeInputSchema = z.object({
  input: z.string().describe("Input video"),
  output: z.string().describe("Output path"),
  type: z.enum(["in", "out", "both"]).describe("Fade type"),
  duration: z.number().describe("Fade duration in seconds"),
});

export const fadeOutputSchema = z.string().describe("Faded video path");

export type FadeInput = z.infer<typeof fadeInputSchema>;
export type FadeOutput = z.infer<typeof fadeOutputSchema>;

export const fadeDefinition: ActionDefinition<
  typeof fadeInputSchema,
  typeof fadeOutputSchema
> = {
  type: "action",
  name: "fade",
  description: "Apply fade in/out effects",
  inputSchema: fadeInputSchema,
  outputSchema: fadeOutputSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, output, type, duration } = inputs;
    return ffmpegProvider.fadeVideo({ input, output, type, duration });
  },
};

// === TRANSITION ===
export const transitionInputSchema = z.object({
  input1: z.string().describe("First video"),
  input2: z.string().describe("Second video"),
  output: z.string().describe("Output path"),
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

export const transitionOutputSchema = z.string().describe("Output path");

export type TransitionInput = z.infer<typeof transitionInputSchema>;
export type TransitionOutput = z.infer<typeof transitionOutputSchema>;

export const transitionDefinition: ActionDefinition<
  typeof transitionInputSchema,
  typeof transitionOutputSchema
> = {
  type: "action",
  name: "transition",
  description: "Apply transition between two videos",
  inputSchema: transitionInputSchema,
  outputSchema: transitionOutputSchema,
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

// === REMOVE ===
export const removeInputSchema = z.object({
  input: z.string().describe("Input video"),
  output: z.string().describe("Output path"),
  what: z
    .enum(["audio", "video"])
    .default("audio")
    .describe("What to extract/remove"),
});

export const removeOutputSchema = z.string().describe("Output path");

export type RemoveInput = z.infer<typeof removeInputSchema>;
export type RemoveOutput = z.infer<typeof removeOutputSchema>;

export const removeDefinition: ActionDefinition<
  typeof removeInputSchema,
  typeof removeOutputSchema
> = {
  type: "action",
  name: "remove",
  description: "Remove audio from video or extract audio",
  inputSchema: removeInputSchema,
  outputSchema: removeOutputSchema,
  routes: [],
  execute: async (inputs) => {
    const { input, output, what = "audio" } = inputs;

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

// Convenience exports (using Zod-inferred types)
export const trim = (opts: TrimInput) => ffmpegProvider.trimVideo(opts);
export const cut = trim;
export const merge = (opts: MergeInput) =>
  ffmpegProvider.concatVideos(opts);
export const split = (opts: SplitInput) =>
  ffmpegProvider.splitAtTimestamps(opts);
export const fade = (opts: FadeInput) => ffmpegProvider.fadeVideo(opts);
export const transition = (opts: TransitionInput) =>
  ffmpegProvider.xfadeVideos(opts);
export const remove = removeDefinition.execute;

export default trimDefinition;
