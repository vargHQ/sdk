import { z } from "zod";

const voiceIdSchema = z.string().min(1);

export const ttsSchema = z.object({
  text: z.string().min(1, "text is required"),
  voice: voiceIdSchema.optional().default("rachel"),
  speed: z.number().min(0.5).max(2).optional(),
  abortSignal: z.instanceof(AbortSignal, {}).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const multilingualV2Schema = ttsSchema.extend({
  stability: z.number().min(0).max(1).optional().default(0.5),
  similarity_boost: z.number().min(0).max(1).optional().default(0.75),
  style: z.number().min(0).max(1).optional().default(0),
  use_speaker_boost: z.boolean().optional().default(true),
});

export const turboV2Schema = ttsSchema.extend({
  stability: z.number().min(0).max(1).optional().default(0.5),
  similarity_boost: z.number().min(0).max(1).optional().default(0.75),
});

export const ELEVENLABS_TTS_SCHEMAS: Record<string, z.ZodSchema> = {
  eleven_multilingual_v2: multilingualV2Schema,
  multilingual_v2: multilingualV2Schema,
  eleven_turbo_v2: turboV2Schema,
  turbo_v2: turboV2Schema,
  eleven_monolingual_v1: ttsSchema,
};

export type TTSBaseOptions = z.infer<typeof ttsSchema>;
export type MultilingualV2Options = z.infer<typeof multilingualV2Schema>;
export type TurboV2Options = z.infer<typeof turboV2Schema>;

export type ElevenLabsTTSOptions =
  | TTSBaseOptions
  | MultilingualV2Options
  | TurboV2Options;
