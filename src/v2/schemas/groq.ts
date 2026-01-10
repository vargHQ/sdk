import { z } from "zod";

export const whisperGroqSchema = z.object({
  audio: z.union([z.string(), z.instanceof(ArrayBuffer)]),
  language: z.string().optional(),
  prompt: z.string().optional(),
  response_format: z
    .enum(["json", "text", "verbose_json"])
    .optional()
    .default("verbose_json"),
  temperature: z.number().min(0).max(1).optional(),
  abortSignal: z.instanceof(AbortSignal).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const GROQ_TRANSCRIPTION_SCHEMAS: Record<string, z.ZodSchema> = {
  whisper: whisperGroqSchema,
  "whisper-large-v3": whisperGroqSchema,
  "whisper-large-v3-turbo": whisperGroqSchema,
};

export type WhisperGroqOptions = z.infer<typeof whisperGroqSchema>;
export type GroqTranscriptionOptions = WhisperGroqOptions;
