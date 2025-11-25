#!/usr/bin/env bun

/**
 * audio transcription service
 * supports groq whisper, fireworks api, and future providers
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { toFile } from "groq-sdk/uploads";
import type { ActionMeta } from "../../cli/types";
import {
  convertFireworksToSRT,
  transcribeWithFireworks as fireworksTranscribe,
} from "../../lib/fireworks";
import { GROQ_MODELS, transcribeAudio as groqTranscribe } from "../../lib/groq";

export const meta: ActionMeta = {
  name: "transcribe",
  type: "action",
  description: "speech to text transcription",
  inputType: "audio",
  outputType: "text",
  schema: {
    input: {
      type: "object",
      required: ["audio"],
      properties: {
        audio: {
          type: "string",
          format: "file-path",
          description: "audio/video file to transcribe",
        },
        provider: {
          type: "string",
          enum: ["groq", "fireworks"],
          default: "groq",
          description: "transcription provider",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output file path",
        },
      },
    },
    output: { type: "string", description: "transcribed text" },
  },
  async run(options) {
    const { audio, provider, output } = options as {
      audio: string;
      provider?: "groq" | "fireworks";
      output?: string;
    };
    return transcribe({ audioUrl: audio, provider, outputPath: output });
  },
};

// types
export interface TranscribeOptions {
  audioUrl: string; // url or local file path
  provider?: "groq" | "fireworks";
  model?: string;
  language?: string;
  outputFormat?: "text" | "srt";
  outputPath?: string;
}

export interface TranscribeResult {
  success: boolean;
  text?: string;
  srt?: string;
  error?: string;
}

// groq transcription
async function transcribeWithGroq(
  audioUrl: string,
  options: {
    model?: string;
    language?: string;
    outputFormat?: "text" | "srt";
  },
): Promise<TranscribeResult> {
  try {
    console.log("[transcribe] using groq whisper...");

    // load audio file (local or remote)
    let audioBuffer: ArrayBuffer;
    let fileName = "audio.mp3";

    if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
      // fetch remote file
      const audioResponse = await fetch(audioUrl);
      audioBuffer = await audioResponse.arrayBuffer();
    } else {
      // read local file with bun
      const file = Bun.file(audioUrl);
      audioBuffer = await file.arrayBuffer();
      fileName = audioUrl.split("/").pop() || "audio.mp3";
    }

    const audioFile = await toFile(audioBuffer, fileName);

    // transcribe with groq
    const text = await groqTranscribe({
      file: audioFile,
      model: options.model || GROQ_MODELS.WHISPER_LARGE,
      language: options.language,
    });

    console.log("[transcribe] groq transcription complete");

    if (options.outputFormat === "srt") {
      // groq returns plain text, so we need to convert to srt
      // for now just return text with warning
      console.warn(
        "[transcribe] groq returns plain text, use fireworks for srt format",
      );
      return { success: true, text, srt: text };
    }

    return { success: true, text };
  } catch (error) {
    console.error("[transcribe] groq error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "groq transcription failed",
    };
  }
}

// fireworks transcription (with srt support)
async function transcribeWithFireworks(
  audioUrl: string,
): Promise<TranscribeResult> {
  try {
    console.log("[transcribe] using fireworks api...");

    const data = await fireworksTranscribe({
      audioPath: audioUrl,
    });

    const srtText = convertFireworksToSRT(data.words || []);
    console.log("[transcribe] fireworks transcription complete");

    return { success: true, srt: srtText, text: data.text };
  } catch (error) {
    console.error("[transcribe] fireworks error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "fireworks transcription failed",
    };
  }
}

// main transcription function
export async function transcribe(
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  const {
    audioUrl,
    provider = "groq",
    model,
    language,
    outputFormat = "text",
    outputPath,
  } = options;

  if (!audioUrl) {
    throw new Error("audioUrl is required");
  }

  console.log(`[transcribe] transcribing ${audioUrl} with ${provider}...`);

  let result: TranscribeResult;

  // choose provider
  if (provider === "groq") {
    result = await transcribeWithGroq(audioUrl, {
      model,
      language,
      outputFormat,
    });
  } else if (provider === "fireworks") {
    result = await transcribeWithFireworks(audioUrl);
  } else {
    throw new Error(`unknown provider: ${provider}`);
  }

  // save to file if requested
  if (result.success && outputPath) {
    const content = outputFormat === "srt" ? result.srt : result.text;
    if (content) {
      writeFileSync(outputPath, content);
      console.log(`[transcribe] saved to ${outputPath}`);
    }
  }

  return result;
}

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run service/transcribe.ts <audioPath> [provider] [outputPath]

arguments:
  audioPath      - url or local path to audio file
  provider       - groq (default) | fireworks
  outputPath     - optional path to save transcription

examples:
  bun run service/transcribe.ts https://example.com/audio.mp3
  bun run service/transcribe.ts media/dora.ogg groq
  bun run service/transcribe.ts https://example.com/audio.mp3 fireworks output.srt
  bun run service/transcribe.ts media/audio.mp3 groq output.txt

providers:
  groq        - ultra-fast whisper (text only, free tier available)
  fireworks   - slower but includes srt timestamps (uses reels-srt api)

environment:
  GROQ_API_KEY - your groq api key (for groq provider)
    `);
    process.exit(0);
  }

  try {
    const audioUrl = args[0];
    const provider = (args[1] || "groq") as "groq" | "fireworks";
    const outputPath = args[2];

    if (!audioUrl) {
      throw new Error("audioUrl is required");
    }

    const result = await transcribe({
      audioUrl,
      provider,
      outputFormat: provider === "fireworks" ? "srt" : "text",
      outputPath: outputPath || join(process.cwd(), "output.txt"),
    });

    if (result.success) {
      console.log("\ntranscription:");
      console.log(result.srt || result.text);
    } else {
      console.error(`\nerror: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("[transcribe] error:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
