#!/usr/bin/env bun

/**
 * fireworks.ai api wrapper for audio transcription with word-level timestamps
 * supports whisper models with advanced features like diarization and vad
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// types
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

export interface FireworksTranscribeOptions {
  audioPath: string; // local file path or url
  vadModel?: "whisperx-pyannet" | "silero";
  alignmentModel?: "tdnn_ffn" | "wav2vec2";
  responseFormat?: "json" | "verbose_json" | "text" | "srt" | "vtt";
  preprocessing?: "none" | "denoise";
  temperature?: string; // comma-separated values like "0,0.2,0.4,0.6,0.8,1"
  timestampGranularities?: "word" | "segment";
  diarize?: boolean;
  language?: string;
  outputPath?: string;
}

// srt conversion
export function convertFireworksToSRT(words: FireworksWord[]): string {
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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

// core function
export async function transcribeWithFireworks(
  options: FireworksTranscribeOptions,
): Promise<FireworksResponse> {
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

  if (!audioPath) {
    throw new Error("audioPath is required");
  }

  if (!process.env.FIREWORKS_API_KEY) {
    throw new Error("FIREWORKS_API_KEY environment variable is required");
  }

  console.log("[fireworks] transcribing audio...");

  try {
    // load audio file (local or remote)
    let audioBlob: Blob;
    let fileName = "audio.mp3";

    if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) {
      // fetch remote file
      const audioResponse = await fetch(audioPath);
      audioBlob = await audioResponse.blob();
      fileName = audioPath.split("/").pop()?.split("?")[0] || "audio.mp3";
    } else {
      // read local file
      const buffer = readFileSync(audioPath);
      audioBlob = new Blob([buffer]);
      fileName = audioPath.split("/").pop() || "audio.mp3";
    }

    // prepare form data
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

    // call fireworks api
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

    // save to file if requested
    if (outputPath) {
      let content: string;

      if (outputPath.endsWith(".srt")) {
        content = convertFireworksToSRT(data.words || []);
      } else if (outputPath.endsWith(".json")) {
        content = JSON.stringify(data, null, 2);
      } else {
        content = data.text;
      }

      writeFileSync(outputPath, content);
      console.log(`[fireworks] saved to ${outputPath}`);
    }

    return data;
  } catch (error) {
    console.error("[fireworks] error:", error);
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
  bun run lib/fireworks.ts <audioPath> [outputPath]

arguments:
  audioPath      - local file path or url to audio file
  outputPath     - optional output file (.srt, .json, or .txt)

examples:
  bun run lib/fireworks.ts media/audio.mp3
  bun run lib/fireworks.ts media/audio.mp3 output.srt
  bun run lib/fireworks.ts https://example.com/audio.mp3 output.json
  bun run lib/fireworks.ts media/dora.ogg transcription.txt

features:
  - word-level timestamps for precise subtitles
  - voice activity detection (vad) for better accuracy
  - speaker diarization support
  - advanced preprocessing options
  - multiple output formats (srt, json, text)

environment:
  FIREWORKS_API_KEY - your fireworks.ai api key
    `);
    process.exit(0);
  }

  try {
    const audioPath = args[0];
    const outputPath = args[1];

    if (!audioPath) {
      throw new Error("audioPath is required");
    }

    const data = await transcribeWithFireworks({
      audioPath,
      outputPath: outputPath || join(process.cwd(), "output.srt"),
    });

    console.log(`\ntranscription:\n${data.text}\n`);
    console.log(`words: ${data.words?.length || 0}`);
    console.log(`language: ${data.language}`);
    console.log(`duration: ${data.duration}s`);
  } catch (error) {
    console.error("[fireworks] error:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
