/**
 * Video editing actions
 * FFmpeg-based local video processing
 */

import type { ActionDefinition } from "../../core/schema/types";
import { ffmpegProvider } from "../../providers/ffmpeg";

// Trim action
export const trimDefinition: ActionDefinition = {
  type: "action",
  name: "trim",
  description: "Trim video to specific time range",
  schema: {
    input: {
      type: "object",
      required: ["input", "output", "start"],
      properties: {
        input: {
          type: "string",
          format: "file-path",
          description: "Input video",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "Output path",
        },
        start: { type: "number", description: "Start time in seconds" },
        duration: { type: "number", description: "Duration in seconds" },
      },
    },
    output: {
      type: "string",
      format: "file-path",
      description: "Trimmed video path",
    },
  },
  routes: [],
  execute: async (inputs) => {
    const { input, output, start, duration } = inputs as {
      input: string;
      output: string;
      start: number;
      duration?: number;
    };
    return ffmpegProvider.trimVideo({ input, output, start, duration });
  },
};

// Cut action (alias for trim)
export const cutDefinition: ActionDefinition = {
  type: "action",
  name: "cut",
  description: "Cut video at specific point",
  schema: trimDefinition.schema,
  routes: [{ target: "trim" }],
};

// Merge action
export const mergeDefinition: ActionDefinition = {
  type: "action",
  name: "merge",
  description: "Merge multiple videos together",
  schema: {
    input: {
      type: "object",
      required: ["inputs", "output"],
      properties: {
        inputs: {
          type: "array",
          items: { type: "string", description: "Video path" },
          description: "Input video paths",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "Output path",
        },
      },
    },
    output: {
      type: "string",
      format: "file-path",
      description: "Merged video path",
    },
  },
  routes: [],
  execute: async (inputs) => {
    const { inputs: videoInputs, output } = inputs as {
      inputs: string[];
      output: string;
    };
    return ffmpegProvider.concatVideos({ inputs: videoInputs, output });
  },
};

// Split action
export const splitDefinition: ActionDefinition = {
  type: "action",
  name: "split",
  description: "Split video at timestamps",
  schema: {
    input: {
      type: "object",
      required: ["input", "timestamps", "outputPrefix"],
      properties: {
        input: {
          type: "string",
          format: "file-path",
          description: "Input video",
        },
        timestamps: {
          type: "array",
          items: { type: "number", description: "Timestamp in seconds" },
          description: "Split points in seconds",
        },
        outputPrefix: { type: "string", description: "Output filename prefix" },
      },
    },
    output: {
      type: "object",
      description: "Output paths array",
    },
  },
  routes: [],
  execute: async (inputs) => {
    const { input, timestamps, outputPrefix } = inputs as {
      input: string;
      timestamps: number[];
      outputPrefix: string;
    };
    return ffmpegProvider.splitAtTimestamps({
      input,
      timestamps,
      outputPrefix,
    });
  },
};

// Fade action
export const fadeDefinition: ActionDefinition = {
  type: "action",
  name: "fade",
  description: "Apply fade in/out effects",
  schema: {
    input: {
      type: "object",
      required: ["input", "output", "type", "duration"],
      properties: {
        input: {
          type: "string",
          format: "file-path",
          description: "Input video",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "Output path",
        },
        type: {
          type: "string",
          enum: ["in", "out", "both"],
          description: "Fade type",
        },
        duration: { type: "number", description: "Fade duration in seconds" },
      },
    },
    output: {
      type: "string",
      format: "file-path",
      description: "Faded video path",
    },
  },
  routes: [],
  execute: async (inputs) => {
    const { input, output, type, duration } = inputs as {
      input: string;
      output: string;
      type: "in" | "out" | "both";
      duration: number;
    };
    return ffmpegProvider.fadeVideo({ input, output, type, duration });
  },
};

// Transition action
export const transitionDefinition: ActionDefinition = {
  type: "action",
  name: "transition",
  description: "Apply transition between two videos",
  schema: {
    input: {
      type: "object",
      required: ["input1", "input2", "output", "transition", "duration"],
      properties: {
        input1: {
          type: "string",
          format: "file-path",
          description: "First video",
        },
        input2: {
          type: "string",
          format: "file-path",
          description: "Second video",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "Output path",
        },
        transition: {
          type: "string",
          enum: [
            "crossfade",
            "dissolve",
            "wipeleft",
            "wiperight",
            "slideup",
            "slidedown",
          ],
          description: "Transition type",
        },
        duration: { type: "number", description: "Transition duration" },
        fit: {
          type: "string",
          enum: ["pad", "crop", "blur", "stretch"],
          default: "pad",
          description: "How to handle different resolutions",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "Output path" },
  },
  routes: [],
  execute: async (inputs) => {
    const { input1, input2, output, transition, duration, fit } = inputs as {
      input1: string;
      input2: string;
      output: string;
      transition:
        | "crossfade"
        | "dissolve"
        | "wipeleft"
        | "wiperight"
        | "slideup"
        | "slidedown";
      duration: number;
      fit?: "pad" | "crop" | "blur" | "stretch";
    };
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

// Remove (audio) action
export const removeDefinition: ActionDefinition = {
  type: "action",
  name: "remove",
  description: "Remove audio from video or extract audio",
  schema: {
    input: {
      type: "object",
      required: ["input", "output"],
      properties: {
        input: {
          type: "string",
          format: "file-path",
          description: "Input video",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "Output path",
        },
        what: {
          type: "string",
          enum: ["audio", "video"],
          default: "audio",
          description: "What to extract/remove",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "Output path" },
  },
  routes: [],
  execute: async (inputs) => {
    const {
      input,
      output,
      what = "audio",
    } = inputs as {
      input: string;
      output: string;
      what?: "audio" | "video";
    };

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
export const remove = removeDefinition.execute!;

export default trimDefinition;
