/**
 * Music generation action
 * Text-to-music via Fal/Sonauto
 */

import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { audioFormatSchema, filePathSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { storageProvider } from "../../providers/storage";

// Input schema with Zod
const musicInputSchema = z.object({
  prompt: z.string().optional().describe("Description of music to generate"),
  tags: z
    .array(z.string())
    .optional()
    .describe("Style tags like 'rock', 'energetic'"),
  lyrics: z.string().optional().describe("Optional lyrics prompt"),
  format: audioFormatSchema.default("mp3").describe("Output format"),
  numSongs: z
    .union([z.literal(1), z.literal(2)])
    .default(1)
    .describe("Number of songs to generate"),
  output: filePathSchema.optional().describe("Output file path"),
});

// Output schema with Zod
const musicOutputSchema = z.object({
  seed: z.number(),
  tags: z.array(z.string()).optional(),
  lyrics: z.string().optional(),
  audio: z.array(
    z.object({
      url: z.string(),
      fileName: z.string(),
      contentType: z.string(),
      fileSize: z.number(),
    }),
  ),
  uploadUrls: z.array(z.string()).optional(),
});

// Schema object for the definition
const schema: ZodSchema<typeof musicInputSchema, typeof musicOutputSchema> = {
  input: musicInputSchema,
  output: musicOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "music",
  description: "Generate music from text prompt or tags",
  schema,
  routes: [],
  execute: async (inputs) => {
    return generateMusic({
      prompt: inputs.prompt,
      tags: inputs.tags,
      lyrics: inputs.lyrics,
      format: inputs.format,
      numSongs: inputs.numSongs,
      outputPath: inputs.output,
    });
  },
};

// Types
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
    throw new Error("Either prompt or tags is required");
  }

  console.log(`[music] generating ${numSongs} song(s)...`);
  if (prompt) console.log(`[music] prompt: ${prompt}`);
  if (tags) console.log(`[music] tags: ${tags.join(", ")}`);

  const result = await falProvider.textToMusic({
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

  // Save files locally if requested
  if (outputPath) {
    for (let i = 0; i < musicResult.audio.length; i++) {
      const audio = musicResult.audio[i];
      if (!audio) continue;

      const ext = format || "wav";
      const filePath =
        musicResult.audio.length === 1
          ? outputPath
          : outputPath.replace(/\.[^.]+$/, `-${i + 1}.${ext}`);

      const response = await fetch(audio.url);
      const buffer = await response.arrayBuffer();
      await writeFile(filePath, Buffer.from(buffer));
      console.log(`[music] saved to ${filePath}`);
    }
  }

  // Upload to storage if requested
  if (upload) {
    const uploadUrls: string[] = [];
    for (let i = 0; i < musicResult.audio.length; i++) {
      const audio = musicResult.audio[i];
      if (!audio) continue;

      const objectKey = `music/${Date.now()}-${i + 1}.${format || "wav"}`;
      const uploadUrl = await storageProvider.uploadFromUrl(
        audio.url,
        objectKey,
      );
      uploadUrls.push(uploadUrl);
      console.log(`[music] uploaded to ${uploadUrl}`);
    }
    musicResult.uploadUrls = uploadUrls;
  }

  return musicResult;
}

export default definition;
