import { z } from "zod";

const baseSyncSchema = z.object({
  video: z.union([z.string(), z.instanceof(ArrayBuffer)]),
  audio: z.union([z.string(), z.instanceof(ArrayBuffer)]),
  abortSignal: z.instanceof(AbortSignal).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const lipsyncSchema = baseSyncSchema.extend({
  sync_mode: z.enum(["cut", "loop", "bounce"]).optional().default("cut"),
});

export const lipsyncV2Schema = baseSyncSchema.extend({
  sync_mode: z.enum(["cut", "loop", "bounce"]).optional().default("cut"),
});

export const sadtalkerSchema = baseSyncSchema.extend({
  preprocess: z.enum(["crop", "resize", "full"]).optional().default("crop"),
  still_mode: z.boolean().optional().default(false),
  expression_scale: z.number().min(0).max(3).optional().default(1),
});

export const FAL_SYNC_SCHEMAS: Record<string, z.ZodSchema> = {
  lipsync: lipsyncSchema,
  "lipsync-v2": lipsyncV2Schema,
  sadtalker: sadtalkerSchema,
};

export type LipsyncOptions = z.infer<typeof lipsyncSchema>;
export type LipsyncV2Options = z.infer<typeof lipsyncV2Schema>;
export type SadtalkerOptions = z.infer<typeof sadtalkerSchema>;

export type FalSyncOptions =
  | LipsyncOptions
  | LipsyncV2Options
  | SadtalkerOptions;
