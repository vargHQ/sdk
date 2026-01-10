import { z } from "zod";

export const whisperSchema = z.object({
  audio: z.union([z.string(), z.instanceof(ArrayBuffer)]),
  language: z.string().optional(),
  prompt: z.string().optional(),
  task: z.enum(["transcribe", "translate"]).optional().default("transcribe"),
  chunk_level: z.enum(["segment", "word"]).optional().default("segment"),
  abortSignal: z.instanceof(AbortSignal).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const FAL_TRANSCRIPTION_SCHEMAS: Record<string, z.ZodSchema> = {
  whisper: whisperSchema,
  "whisper-large-v3": whisperSchema,
};

export type WhisperOptions = z.infer<typeof whisperSchema>;
export type FalTranscriptionOptions = WhisperOptions;
