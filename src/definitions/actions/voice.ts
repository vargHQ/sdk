/**
 * Voice generation action
 * Text-to-speech via ElevenLabs
 */

import { z } from "zod";
import type { ActionDefinition } from "../../core/schema/types";
import { elevenlabsProvider, VOICES } from "../../providers/elevenlabs";
import { storageProvider } from "../../providers/storage";

export const voiceInputSchema = z.object({
  text: z.string().describe("Text to convert to speech"),
  voice: z
    .enum(["rachel", "domi", "bella", "antoni", "josh", "adam", "sam"])
    .optional()
    .default("rachel")
    .describe("Voice to use"),
  output: z.string().optional().describe("Output file path"),
});

export const voiceOutputSchema = z.object({
  audio: z.instanceof(Buffer),
  provider: z.string(),
  voiceId: z.string(),
  uploadUrl: z.string().optional(),
});

export type VoiceInput = z.infer<typeof voiceInputSchema>;
export type VoiceOutput = z.infer<typeof voiceOutputSchema>;

export const definition: ActionDefinition<
  typeof voiceInputSchema,
  typeof voiceOutputSchema
> = {
  type: "action",
  name: "voice",
  description: "Text to speech generation",
  inputSchema: voiceInputSchema,
  outputSchema: voiceOutputSchema,
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

// Voice name to ID mapping
const VOICE_MAP: Record<string, string> = {
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

  const audio = await elevenlabsProvider.textToSpeech({
    text,
    voiceId,
    outputPath,
  });

  const result: VoiceResult = {
    audio,
    provider,
    voiceId,
  };

  // Upload to storage if requested
  if (upload && outputPath) {
    const objectKey = `voice/${Date.now()}-${voice}.mp3`;
    const uploadUrl = await storageProvider.uploadLocalFile(
      outputPath,
      objectKey,
    );
    result.uploadUrl = uploadUrl;
    console.log(`[voice] uploaded to ${uploadUrl}`);
  }

  return result;
}

export default definition;
