/**
 * Voice generation action
 * Text-to-speech via ElevenLabs
 */

import { z } from "zod";
import { filePathSchema, voiceSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { elevenlabsProvider, VOICES } from "../../providers/elevenlabs";
import { storageProvider } from "../../providers/storage";

// Input schema with Zod — accepts any voice name or ElevenLabs voice_id
const voiceInputSchema = z.object({
  text: z.string().describe("Text to convert to speech"),
  voice: voiceSchema
    .default("rachel")
    .describe("Voice name or ElevenLabs voice_id"),
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

// Voice name to ID mapping. Unknown names pass through as voice_ids.
const VOICE_MAP: Record<string, string> = {
  // Current ElevenLabs premade voices (source: skills/varg-ai/references/models.md)
  adam: VOICES.ADAM,
  alice: VOICES.ALICE,
  bella: VOICES.BELLA,
  bill: VOICES.BILL,
  brian: VOICES.BRIAN,
  callum: VOICES.CALLUM,
  charlie: VOICES.CHARLIE,
  chris: VOICES.CHRIS,
  daniel: VOICES.DANIEL,
  eric: VOICES.ERIC,
  george: VOICES.GEORGE,
  harry: VOICES.HARRY,
  jessica: VOICES.JESSICA,
  laura: VOICES.LAURA,
  liam: VOICES.LIAM,
  lily: VOICES.LILY,
  matilda: VOICES.MATILDA,
  river: VOICES.RIVER,
  roger: VOICES.ROGER,
  sarah: VOICES.SARAH,
  will: VOICES.WILL,
  // Legacy
  rachel: VOICES.RACHEL,
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
