#!/usr/bin/env bun

/**
 * elevenlabs api wrapper for voice generation and text-to-speech
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// types
export interface TextToSpeechOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputPath?: string;
}

export interface VoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

// popular voices
export const VOICES = {
  RACHEL: "21m00Tcm4TlvDq8ikWAM",
  DOMI: "AZnzlk1XvdvUeBnXmlld",
  BELLA: "EXAVITQu4vr4xnSDxMaL",
  ANTONI: "ErXwobaYiN019PkySvjV",
  ELLI: "MF3mGyEYCl7XYWbV9V6O",
  JOSH: "TxGEqnHWrfWFTfGW9XjX",
  ARNOLD: "VR6AewLTigWG4xSOukaG",
  ADAM: "pNInz6obpgDQGcFmaJgB",
  SAM: "yoZ06aMxZJJ28mfd3POQ",
};

// core functions
export async function textToSpeech(options: TextToSpeechOptions) {
  const {
    text,
    voiceId = VOICES.RACHEL,
    modelId = "eleven_multilingual_v2",
    outputPath,
  } = options;

  if (!text) {
    throw new Error("text is required");
  }

  console.log(`[elevenlabs] generating speech with voice ${voiceId}...`);

  try {
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: "mp3_44100_128",
    });

    // convert readablestream to buffer
    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    // save to file if path provided
    if (outputPath) {
      writeFileSync(outputPath, buffer);
      console.log(`[elevenlabs] saved to ${outputPath}`);
    }

    console.log(`[elevenlabs] generated ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error(`[elevenlabs] error:`, error);
    throw error;
  }
}

export async function listVoices() {
  console.log(`[elevenlabs] fetching voices...`);

  try {
    const response = await elevenlabs.voices.getAll();
    console.log(`[elevenlabs] found ${response.voices.length} voices`);
    return response.voices;
  } catch (error) {
    console.error(`[elevenlabs] error:`, error);
    throw error;
  }
}

export async function getVoice(voiceId: string) {
  console.log(`[elevenlabs] fetching voice ${voiceId}...`);

  try {
    const voice = await elevenlabs.voices.get(voiceId);
    console.log(`[elevenlabs] found voice: ${voice.name}`);
    return voice;
  } catch (error) {
    console.error(`[elevenlabs] error:`, error);
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
  bun run lib/elevenlabs.ts <command> [args]

commands:
  tts <text> [voiceId] [outputPath]    generate speech from text
  voices                               list available voices
  voice <voiceId>                      get voice details
  help                                 show this help

examples:
  bun run lib/elevenlabs.ts tts "hello world" "21m00Tcm4TlvDq8ikWAM" output.mp3
  bun run lib/elevenlabs.ts tts "hello world" rachel output.mp3
  bun run lib/elevenlabs.ts voices
  bun run lib/elevenlabs.ts voice 21m00Tcm4TlvDq8ikWAM

popular voices:
  rachel    - 21m00Tcm4TlvDq8ikWAM (american female)
  domi      - AZnzlk1XvdvUeBnXmlld (american female)
  bella     - EXAVITQu4vr4xnSDxMaL (american female)
  antoni    - ErXwobaYiN019PkySvjV (american male)
  elli      - MF3mGyEYCl7XYWbV9V6O (american female)
  josh      - TxGEqnHWrfWFTfGW9XjX (american male)
  arnold    - VR6AewLTigWG4xSOukaG (american male)
  adam      - pNInz6obpgDQGcFmaJgB (american male)
  sam       - yoZ06aMxZJJ28mfd3POQ (american male)

environment:
  ELEVENLABS_API_KEY - your elevenlabs api key
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "tts": {
        const text = args[1];
        let voiceId = args[2];
        const outputPath = args[3];

        if (!text) {
          throw new Error("text is required");
        }

        // map voice names to ids
        const voiceNameMap: Record<string, string> = {
          rachel: VOICES.RACHEL,
          domi: VOICES.DOMI,
          bella: VOICES.BELLA,
          antoni: VOICES.ANTONI,
          elli: VOICES.ELLI,
          josh: VOICES.JOSH,
          arnold: VOICES.ARNOLD,
          adam: VOICES.ADAM,
          sam: VOICES.SAM,
        };

        if (voiceId && voiceNameMap[voiceId.toLowerCase()]) {
          voiceId = voiceNameMap[voiceId.toLowerCase()];
        }

        const buffer = await textToSpeech({
          text,
          voiceId,
          outputPath: outputPath || join(process.cwd(), "output.mp3"),
        });

        console.log(`[elevenlabs] generated ${buffer.length} bytes`);
        break;
      }

      case "voices": {
        const voices = await listVoices();
        console.log(
          `\navailable voices:\n${voices.map((v) => `  ${v.voiceId} - ${v.name}`).join("\n")}`,
        );
        break;
      }

      case "voice": {
        const voiceId = args[1];

        if (!voiceId) {
          throw new Error("voiceId is required");
        }

        const voice = await getVoice(voiceId);
        console.log(`\nvoice details:`, {
          id: voice.voiceId,
          name: voice.name,
          category: voice.category,
          labels: voice.labels,
        });
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run lib/elevenlabs.ts help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[elevenlabs] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
