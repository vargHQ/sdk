#!/usr/bin/env bun

/**
 * music service - high-level music generation using sonauto via fal.ai
 * supports text-to-music with customizable styles, lyrics, and parameters
 */

import { writeFile } from "node:fs/promises";
import { textToMusic } from "../../lib/fal";
import { uploadFromUrl } from "../../utilities/s3";

// types
export interface GenerateMusicOptions {
  prompt?: string;
  tags?: string[];
  lyrics?: string;
  seed?: number;
  promptStrength?: number;
  balanceStrength?: number;
  numSongs?: 1 | 2;
  format?: "flac" | "mp3" | "wav" | "ogg" | "m4a";
  bitRate?: 128 | 192 | 256 | 320;
  bpm?: number | "auto";
  upload?: boolean;
  outputPath?: string;
}

export interface MusicResult {
  seed: number;
  tags?: string[];
  lyrics?: string;
  audio: Array<{
    url: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }>;
  uploadUrls?: string[];
}

// core functions
export async function generateMusic(
  options: GenerateMusicOptions,
): Promise<MusicResult> {
  const {
    prompt,
    tags,
    lyrics,
    seed,
    promptStrength = 2,
    balanceStrength = 0.7,
    numSongs = 1,
    format = "mp3",
    bitRate,
    bpm = "auto",
    upload = false,
    outputPath,
  } = options;

  if (!prompt && !tags) {
    throw new Error("either prompt or tags is required");
  }

  console.log(`[music] generating ${numSongs} song(s)...`);
  if (prompt) console.log(`[music] prompt: ${prompt}`);
  if (tags) console.log(`[music] tags: ${tags.join(", ")}`);
  if (lyrics) console.log(`[music] lyrics: ${lyrics.substring(0, 50)}...`);

  const result = await textToMusic({
    prompt,
    tags,
    lyricsPrompt: lyrics,
    seed,
    promptStrength,
    balanceStrength,
    numSongs,
    outputFormat: format,
    outputBitRate: bitRate,
    bpm,
  });

  const musicResult: MusicResult = {
    seed: result.data.seed,
    tags: result.data.tags,
    lyrics: result.data.lyrics,
    audio: Array.isArray(result.data.audio)
      ? result.data.audio.map(
          (a: {
            url: string;
            file_name: string;
            content_type: string;
            file_size: number;
          }) => ({
            url: a.url,
            fileName: a.file_name,
            contentType: a.content_type,
            fileSize: a.file_size,
          }),
        )
      : [
          {
            url: result.data.audio.url,
            fileName: result.data.audio.file_name,
            contentType: result.data.audio.content_type,
            fileSize: result.data.audio.file_size,
          },
        ],
  };

  // save files locally if requested
  if (outputPath) {
    for (let i = 0; i < musicResult.audio.length; i++) {
      const audio = musicResult.audio[i];
      if (!audio) continue;

      const ext = format || "wav";
      const filePath =
        musicResult.audio.length === 1
          ? outputPath
          : outputPath.replace(/\.[^.]+$/, `-${i + 1}.${ext}`);

      // download the audio
      const response = await fetch(audio.url);
      const buffer = await response.arrayBuffer();
      await writeFile(filePath, Buffer.from(buffer));
      console.log(`[music] saved to ${filePath}`);
    }
  }

  // upload to s3 if requested
  if (upload) {
    const uploadUrls: string[] = [];
    for (let i = 0; i < musicResult.audio.length; i++) {
      const audio = musicResult.audio[i];
      if (!audio) continue;

      const objectKey = `music/${Date.now()}-${i + 1}.${format || "wav"}`;
      const uploadUrl = await uploadFromUrl(audio.url, objectKey);
      uploadUrls.push(uploadUrl);
      console.log(`[music] uploaded to ${uploadUrl}`);
    }
    musicResult.uploadUrls = uploadUrls;
  }

  return musicResult;
}

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run service/music <command> [args]

commands:
  generate <prompt> [format] [numSongs] [upload]   generate music from prompt
  tags <tags...> [format] [upload]                 generate music from tags
  instrumental <tags...> [format] [upload]         generate instrumental track
  help                                             show this help

examples:
  bun run service/music generate "A pop song about turtles flying"
  bun run service/music generate "upbeat electronic" mp3 2 true
  bun run service/music tags "rock" "energetic" "guitar" mp3
  bun run service/music instrumental "ambient" "calm" "piano" wav true

formats:
  mp3 (default), wav, flac, ogg, m4a

environment:
  FAL_API_KEY - required for music generation
  CLOUDFLARE_* - required for upload
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "generate": {
        const prompt = args[1];
        const format = (args[2] || "mp3") as
          | "flac"
          | "mp3"
          | "wav"
          | "ogg"
          | "m4a";
        const numSongs = (Number.parseInt(args[3] || "1", 10) || 1) as 1 | 2;
        const upload = args[4] === "true";

        if (!prompt) {
          throw new Error("prompt is required");
        }

        const outputPath = `media/music-${Date.now()}.${format}`;

        const result = await generateMusic({
          prompt,
          format,
          numSongs,
          upload,
          outputPath,
        });

        console.log(`[music] result:`, {
          seed: result.seed,
          tags: result.tags,
          audioCount: result.audio.length,
          outputPath,
          uploadUrls: result.uploadUrls,
        });
        break;
      }

      case "tags": {
        // collect all tag arguments until we hit format/upload
        const tags: string[] = [];
        let format: "flac" | "mp3" | "wav" | "ogg" | "m4a" = "mp3";
        let upload = false;

        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg && ["mp3", "wav", "flac", "ogg", "m4a"].includes(arg)) {
            format = arg as "flac" | "mp3" | "wav" | "ogg" | "m4a";
          } else if (arg === "true") {
            upload = true;
          } else if (arg) {
            tags.push(arg);
          }
        }

        if (tags.length === 0) {
          throw new Error("at least one tag is required");
        }

        const outputPath = `media/music-${Date.now()}.${format}`;

        const result = await generateMusic({
          tags,
          format,
          upload,
          outputPath,
        });

        console.log(`[music] result:`, {
          seed: result.seed,
          tags: result.tags,
          audioCount: result.audio.length,
          outputPath,
          uploadUrls: result.uploadUrls,
        });
        break;
      }

      case "instrumental": {
        // same as tags but with empty lyrics
        const tags: string[] = [];
        let format: "flac" | "mp3" | "wav" | "ogg" | "m4a" = "mp3";
        let upload = false;

        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg && ["mp3", "wav", "flac", "ogg", "m4a"].includes(arg)) {
            format = arg as "flac" | "mp3" | "wav" | "ogg" | "m4a";
          } else if (arg === "true") {
            upload = true;
          } else if (arg) {
            tags.push(arg);
          }
        }

        if (tags.length === 0) {
          throw new Error("at least one tag is required");
        }

        const outputPath = `media/music-${Date.now()}.${format}`;

        const result = await generateMusic({
          tags,
          lyrics: "", // empty string for instrumental
          format,
          upload,
          outputPath,
        });

        console.log(`[music] result:`, {
          seed: result.seed,
          tags: result.tags,
          audioCount: result.audio.length,
          outputPath,
          uploadUrls: result.uploadUrls,
        });
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run service/music help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[music] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
