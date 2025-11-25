#!/usr/bin/env bun

/**
 * lipsync service - combines video with audio using various methods
 * supports wav2lip, synclabs, and simple audio overlay
 */

import { addAudio } from "../../lib/ffmpeg";
import { runModel } from "../../lib/replicate";

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
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run service/sync.ts <command> [args]

commands:
  sync <videoUrl> <audioUrl> [method] [output]     sync video with audio
  wav2lip <videoUrl> <audioUrl>                    use wav2lip model
  overlay <videoPath> <audioPath> [output]         simple audio overlay
  help                                             show this help

methods:
  wav2lip    - ai-powered lipsync using replicate (url inputs)
  overlay    - simple audio overlay using ffmpeg (local files)

examples:
  bun run service/sync.ts sync video.mp4 audio.mp3 overlay output.mp4
  bun run service/sync.ts wav2lip https://example.com/video.mp4 https://example.com/audio.mp3
  bun run service/sync.ts overlay video.mp4 audio.mp3 synced.mp4

environment:
  REPLICATE_API_TOKEN - required for wav2lip method
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "sync": {
        const videoUrl = args[1];
        const audioUrl = args[2];
        const method = (args[3] || "overlay") as "wav2lip" | "overlay";
        const output = args[4];

        if (!videoUrl || !audioUrl) {
          throw new Error("videoUrl and audioUrl are required");
        }

        const result = await lipsync({
          videoUrl,
          audioUrl,
          method,
          output,
        });

        console.log(`[sync] result:`, result);
        break;
      }

      case "wav2lip": {
        const videoUrl = args[1];
        const audioUrl = args[2];

        if (!videoUrl || !audioUrl) {
          throw new Error("videoUrl and audioUrl are required");
        }

        const result = await lipsyncWav2Lip({ videoUrl, audioUrl });
        console.log(`[sync] result:`, result);
        break;
      }

      case "overlay": {
        const videoPath = args[1];
        const audioPath = args[2];
        const output = args[3];

        if (!videoPath || !audioPath) {
          throw new Error("videoPath and audioPath are required");
        }

        const result = await lipsyncOverlay(videoPath, audioPath, output);
        console.log(`[sync] result:`, result);
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run service/sync.ts help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[sync] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
