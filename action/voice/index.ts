#!/usr/bin/env bun

/**
 * voice service - high-level voice generation combining multiple providers
 * supports elevenlabs and future providers
 */

import type { ActionMeta } from "../../cli/types";
import { textToSpeech, VOICES } from "../../lib/elevenlabs";
import { uploadFile } from "../../utilities/s3";

export const meta: ActionMeta = {
  name: "voice",
  type: "action",
  description: "text to speech generation",
  inputType: "text",
  outputType: "audio",
  schema: {
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", description: "text to convert to speech" },
        voice: {
          type: "string",
          enum: ["rachel", "domi", "bella", "antoni", "josh", "adam", "sam"],
          default: "rachel",
          description: "voice to use",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output file path",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "audio path" },
  },
  async run(options) {
    const { text, voice, output } = options as {
      text: string;
      voice?: string;
      output?: string;
    };
    return generateVoice({ text, voice, outputPath: output });
  },
};

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
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
