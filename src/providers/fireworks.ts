/**
 * Fireworks.ai provider for audio transcription with word-level timestamps
 * Supports Whisper models with advanced features like diarization and VAD
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

// Types
export interface FireworksWord {
  word: string;
  language: string;
  probability: number;
  hallucination_score: number;
  start: number;
  end: number;
  retry_count: number;
}

export interface FireworksResponse {
  task: string;
  language: string;
  text: string;
  request_id: string;
  words: FireworksWord[];
  duration: number;
}

export class FireworksProvider extends BaseProvider {
  readonly name = "fireworks";

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    config?: ProviderConfig,
  ): Promise<string> {
    const jobId = `fw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(`[fireworks] starting transcription: ${jobId}`);
    return jobId;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    return { status: "completed" };
  }

  async getResult(jobId: string): Promise<unknown> {
    return null;
  }

  // ============================================================================
  // High-level convenience methods
  // ============================================================================

  async transcribe(options: {
    audioPath: string;
    vadModel?: "whisperx-pyannet" | "silero";
    alignmentModel?: "tdnn_ffn" | "wav2vec2";
    responseFormat?: "json" | "verbose_json" | "text" | "srt" | "vtt";
    preprocessing?: "none" | "denoise";
    temperature?: string;
    timestampGranularities?: "word" | "segment";
    diarize?: boolean;
    language?: string;
    outputPath?: string;
  }): Promise<FireworksResponse> {
    const {
      audioPath,
      vadModel = "whisperx-pyannet",
      alignmentModel = "tdnn_ffn",
      responseFormat = "verbose_json",
      preprocessing = "none",
      temperature = "0,0.2,0.4,0.6,0.8,1",
      timestampGranularities = "word",
      diarize = false,
      language,
      outputPath,
    } = options;

    if (!process.env.FIREWORKS_API_KEY) {
      throw new Error("FIREWORKS_API_KEY environment variable is required");
    }

    console.log("[fireworks] transcribing audio...");

    // Load audio file
    let audioBlob: Blob;
    let fileName = "audio.mp3";

    if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) {
      const audioResponse = await fetch(audioPath);
      audioBlob = await audioResponse.blob();
      fileName = audioPath.split("/").pop()?.split("?")[0] || "audio.mp3";
    } else {
      const buffer = readFileSync(audioPath);
      audioBlob = new Blob([buffer]);
      fileName = audioPath.split("/").pop() || "audio.mp3";
    }

    // Prepare form data
    const formData = new FormData();
    formData.append("file", audioBlob, fileName);
    formData.append("vad_model", vadModel);
    formData.append("alignment_model", alignmentModel);
    formData.append("response_format", responseFormat);
    formData.append("preprocessing", preprocessing);
    formData.append("temperature", temperature);
    formData.append("timestamp_granularities", timestampGranularities);
    formData.append("diarize", diarize.toString());

    if (language) {
      formData.append("language", language);
    }

    // Call Fireworks API
    const response = await fetch(
      "https://audio-prod.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fireworks] api error:", errorText);
      throw new Error(`fireworks api error: ${response.statusText}`);
    }

    const data = (await response.json()) as FireworksResponse;

    console.log(
      `[fireworks] transcription complete (${data.words?.length || 0} words)`,
    );

    // Save to file if requested
    if (outputPath) {
      let content: string;

      if (outputPath.endsWith(".srt")) {
        content = convertToSRT(data.words || []);
      } else if (outputPath.endsWith(".json")) {
        content = JSON.stringify(data, null, 2);
      } else {
        content = data.text;
      }

      writeFileSync(outputPath, content);
      console.log(`[fireworks] saved to ${outputPath}`);
    }

    return data;
  }
}

// Helper function to convert words to SRT format
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function convertToSRT(words: FireworksWord[]): string {
  let srt = "";
  let index = 1;

  for (const word of words) {
    const startTime = formatTime(word.start);
    const endTime = formatTime(word.end);

    srt += `${index}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${word.word.trim()}\n\n`;
    index++;
  }

  return srt;
}

// Export singleton instance
export const fireworksProvider = new FireworksProvider();

// Re-export convenience functions for backward compatibility
export const transcribeWithFireworks = (
  options: Parameters<FireworksProvider["transcribe"]>[0],
) => fireworksProvider.transcribe(options);
export const convertFireworksToSRT = convertToSRT;
