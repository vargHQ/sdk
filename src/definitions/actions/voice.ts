/**
 * Voice generation action
 * Text-to-speech via ElevenLabs
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { z } from "zod";
import { filePathSchema, voiceNameSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";

// Input schema with Zod
const voiceInputSchema = z.object({
  text: z.string().describe("Text to convert to speech"),
  voice: voiceNameSchema.default("rachel").describe("Voice to use"),
  output: filePathSchema.optional().describe("Output file path"),
});

// Output schema with Zod
const voiceOutputSchema = z.object({
  audio: z.instanceof(Buffer),
  provider: z.string(),
  voiceId: z.string(),
  uploadUrl: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<typeof voiceInputSchema, typeof voiceOutputSchema> = {
  input: voiceInputSchema,
  output: voiceOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "voice",
  description: "Text to speech generation",
  schema,
  routes: [],
  execute: async (inputs) => {
    const { text, voice, output } = inputs;
    return generateVoice({ text, voice, outputPath: output });
  },
};

// Types
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

const VOICE_MAP: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  domi: "AZnzlk1XvdvUeBnXmlld",
  bella: "EXAVITQu4vr4xnSDxMaL",
  antoni: "ErXwobaYiN019PkySvjV",
  elli: "MF3mGyEYCl7XYWbV9V6O",
  josh: "TxGEqnHWrfWFTfGW9XjX",
  arnold: "VR6AewLTigWG4xSOukaG",
  adam: "pNInz6obpgDQGcFmaJgB",
  sam: "yoZ06aMxZJJ28mfd3POQ",
};

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

  const voiceId = VOICE_MAP[voice.toLowerCase()] || voice;

  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  const audioStream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk));
  }
  const audio = Buffer.concat(chunks);

  if (outputPath) {
    await Bun.write(outputPath, audio);
    console.log(`[voice] saved to ${outputPath}`);
  }

  return {
    audio,
    provider,
    voiceId,
  };
}

export default definition;
