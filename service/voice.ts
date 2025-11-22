#!/usr/bin/env bun

/**
 * voice service - high-level voice generation combining multiple providers
 * supports elevenlabs and future providers
 */

import { textToSpeech, VOICES } from "../lib/elevenlabs";
import { uploadFile } from "../utilities/s3";

// types
export interface GenerateVoiceOptions {
  text: string;
  voice?: string;
  provider?: "elevenlabs";
  upload?: boolean;
  outputPath?: string;
}

export interface VoiceResult {
  audio: Buffer;
  provider: string;
  voiceId: string;
  uploadUrl?: string;
}

// core functions
export async function generateVoice(
  options: GenerateVoiceOptions,
): Promise<VoiceResult> {
  const {
    text,
    voice = "rachel",
    provider = "elevenlabs",
    upload = false,
    outputPath,
  } = options;

  if (!text) {
    throw new Error("text is required");
  }

  console.log(`[voice] generating with ${provider} (${voice})...`);

  let audio: Buffer;
  let voiceId: string;

  switch (provider) {
    case "elevenlabs": {
      // map friendly names to voice ids
      const voiceMap: Record<string, string> = {
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

      voiceId = voiceMap[voice.toLowerCase()] || voice;

      audio = await textToSpeech({
        text,
        voiceId,
        outputPath,
      });
      break;
    }

    default:
      throw new Error(`unsupported provider: ${provider}`);
  }

  const result: VoiceResult = {
    audio,
    provider,
    voiceId,
  };

  // upload to s3 if requested
  if (upload && outputPath) {
    const objectKey = `voice/${Date.now()}-${voice}.mp3`;
    const uploadUrl = await uploadFile(outputPath, objectKey);
    result.uploadUrl = uploadUrl;
    console.log(`[voice] uploaded to ${uploadUrl}`);
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
  bun run service/voice.ts <command> [args]

commands:
  generate <text> [voice] [provider] [upload]    generate voice from text
  elevenlabs <text> [voice] [upload]             generate with elevenlabs
  help                                           show this help

examples:
  bun run service/voice.ts generate "hello world" rachel elevenlabs false
  bun run service/voice.ts elevenlabs "hello world" josh true
  bun run service/voice.ts generate "welcome to ai" bella

available voices:
  rachel, domi, bella, antoni, elli, josh, arnold, adam, sam

providers:
  elevenlabs (default)

environment:
  ELEVENLABS_API_KEY - required for elevenlabs
  CLOUDFLARE_* - required for upload
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "generate": {
        const text = args[1];
        const voice = args[2];
        const provider = (args[3] || "elevenlabs") as "elevenlabs";
        const upload = args[4] === "true";

        if (!text) {
          throw new Error("text is required");
        }

        const outputPath = `media/voice-${Date.now()}.mp3`;

        const result = await generateVoice({
          text,
          voice,
          provider,
          upload,
          outputPath,
        });

        console.log(`[voice] result:`, {
          provider: result.provider,
          voiceId: result.voiceId,
          audioSize: result.audio.length,
          outputPath,
          uploadUrl: result.uploadUrl,
        });
        break;
      }

      case "elevenlabs": {
        const text = args[1];
        const voice = args[2];
        const upload = args[3] === "true";

        if (!text) {
          throw new Error("text is required");
        }

        const outputPath = `media/voice-${Date.now()}.mp3`;

        const result = await generateVoice({
          text,
          voice,
          provider: "elevenlabs",
          upload,
          outputPath,
        });

        console.log(`[voice] result:`, {
          provider: result.provider,
          voiceId: result.voiceId,
          audioSize: result.audio.length,
          outputPath,
          uploadUrl: result.uploadUrl,
        });
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run service/voice.ts help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[voice] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
