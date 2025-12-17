/**
 * Voice generation action
 * Text-to-speech via ElevenLabs
 */

import type { ActionDefinition } from "../../core/schema/types";
import { elevenlabsProvider, VOICES } from "../../providers/elevenlabs";
import { storageProvider } from "../../providers/storage";

export const definition: ActionDefinition = {
  type: "action",
  name: "voice",
  description: "Text to speech generation",
  schema: {
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", description: "Text to convert to speech" },
        voice: {
          type: "string",
          enum: ["rachel", "domi", "bella", "antoni", "josh", "adam", "sam"],
          default: "rachel",
          description: "Voice to use",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "Output file path",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "Audio path" },
  },
  routes: [],
  execute: async (inputs) => {
    const { text, voice, output } = inputs as {
      text: string;
      voice?: string;
      output?: string;
    };
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
