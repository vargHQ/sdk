/**
 * Transcription action
 * Speech-to-text via Groq or Fireworks
 */

import { writeFileSync } from "node:fs";
import { toFile } from "groq-sdk/uploads";
import { z } from "zod";
import {
  filePathSchema,
  transcriptionProviderSchema,
} from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import {
  convertFireworksToSRT,
  fireworksProvider,
} from "../../providers/fireworks";
import { GROQ_MODELS, groqProvider } from "../../providers/groq";

// Input schema with Zod
const transcribeInputSchema = z.object({
  audio: filePathSchema.describe("Audio/video file to transcribe"),
  provider: transcriptionProviderSchema
    .default("groq")
    .describe("Transcription provider"),
  output: filePathSchema.optional().describe("Output file path"),
});

// Output schema with Zod
const transcribeOutputSchema = z.object({
  success: z.boolean(),
  text: z.string().optional(),
  srt: z.string().optional(),
  error: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof transcribeInputSchema,
  typeof transcribeOutputSchema
> = {
  input: transcribeInputSchema,
  output: transcribeOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "transcribe",
  description: "Speech to text transcription",
  schema,
  routes: [],
  execute: async (inputs) => {
    const { audio, provider, output } = inputs;
    return transcribe({ audioUrl: audio, provider, outputPath: output });
  },
};

// Types
export interface TranscribeOptions {
  audioUrl: string;
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

// Groq transcription
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

    // Load audio file
    let audioBuffer: ArrayBuffer;
    let fileName = "audio.mp3";

    if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
      const audioResponse = await fetch(audioUrl);
      audioBuffer = await audioResponse.arrayBuffer();
    } else {
      const file = Bun.file(audioUrl);
      audioBuffer = await file.arrayBuffer();
      fileName = audioUrl.split("/").pop() || "audio.mp3";
    }

    const audioFile = await toFile(audioBuffer, fileName);

    const text = await groqProvider.transcribeAudio({
      file: audioFile,
      model: options.model || GROQ_MODELS.WHISPER_LARGE,
      language: options.language,
    });

    console.log("[transcribe] groq transcription complete");

    if (options.outputFormat === "srt") {
      console.warn(
        "[transcribe] groq returns plain text, use fireworks for SRT format",
      );
      return { success: true, text, srt: text };
    }

    return { success: true, text };
  } catch (error) {
    console.error("[transcribe] groq error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Groq transcription failed",
    };
  }
}

// Fireworks transcription (with SRT support)
async function transcribeWithFireworks(
  audioUrl: string,
): Promise<TranscribeResult> {
  try {
    console.log("[transcribe] using fireworks api...");

    const data = await fireworksProvider.transcribe({
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
          : "Fireworks transcription failed",
    };
  }
}

// Main transcription function
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

  if (provider === "groq") {
    result = await transcribeWithGroq(audioUrl, {
      model,
      language,
      outputFormat,
    });
  } else if (provider === "fireworks") {
    result = await transcribeWithFireworks(audioUrl);
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Save to file if requested
  if (result.success && outputPath) {
    const content = outputFormat === "srt" ? result.srt : result.text;
    if (content) {
      writeFileSync(outputPath, content);
      console.log(`[transcribe] saved to ${outputPath}`);
    }
  }

  return result;
}

export default definition;
