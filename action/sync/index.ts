#!/usr/bin/env bun

/**
 * lipsync service - combines video with audio using various methods
 * supports wav2lip, synclabs, and simple audio overlay
 */

import type { ActionMeta } from "../../cli/types";
import { addAudio } from "../../lib/ffmpeg";
import { runModel } from "../../lib/replicate";

export const meta: ActionMeta = {
  name: "sync",
  type: "action",
  description: "sync audio to video (lipsync)",
  inputType: "video+audio",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "audio"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file or url",
        },
        audio: {
          type: "string",
          format: "file-path",
          description: "audio file or url to sync",
        },
        method: {
          type: "string",
          enum: ["wav2lip", "overlay"],
          default: "overlay",
          description: "sync method (wav2lip requires urls)",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output video path",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { video, audio, method, output } = options as {
      video: string;
      audio: string;
      method?: "wav2lip" | "overlay";
      output?: string;
    };
    return lipsync({ videoUrl: video, audioUrl: audio, method, output });
  },
};

// types
export interface LipsyncOptions {
  videoUrl: string;
  audioUrl: string;
  method?: "wav2lip" | "synclabs" | "overlay";
  output?: string;
}

export interface Wav2LipOptions {
  videoUrl: string;
  audioUrl: string;
}

// core functions
export async function lipsync(options: LipsyncOptions) {
  const { videoUrl, audioUrl, method = "overlay", output } = options;

  if (!videoUrl || !audioUrl) {
    throw new Error("videoUrl and audioUrl are required");
  }

  console.log(`[sync] syncing video with audio using ${method}...`);

  switch (method) {
    case "wav2lip":
      return await lipsyncWav2Lip({ videoUrl, audioUrl });

    case "synclabs":
      console.log(
        `[sync] synclabs not yet implemented, falling back to overlay`,
      );
      return await lipsyncOverlay(videoUrl, audioUrl, output);

    case "overlay":
      return await lipsyncOverlay(videoUrl, audioUrl, output);

    default:
      throw new Error(`unknown lipsync method: ${method}`);
  }
}

export async function lipsyncWav2Lip(options: Wav2LipOptions) {
  const { videoUrl, audioUrl } = options;

  console.log(`[sync] using wav2lip model...`);

  try {
    const output = await runModel("devxpy/cog-wav2lip", {
      face: videoUrl,
      audio: audioUrl,
    });

    console.log(`[sync] wav2lip completed`);
    return output;
  } catch (error) {
    console.error(`[sync] wav2lip error:`, error);
    throw error;
  }
}

export async function lipsyncOverlay(
  videoPath: string,
  audioPath: string,
  output: string = "output-synced.mp4",
) {
  console.log(`[sync] overlaying audio on video...`);

  try {
    const result = await addAudio({
      videoPath,
      audioPath,
      output,
    });

    console.log(`[sync] overlay completed`);
    return result;
  } catch (error) {
    console.error(`[sync] overlay error:`, error);
    throw error;
  }
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
