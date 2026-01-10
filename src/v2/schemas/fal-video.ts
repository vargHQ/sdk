import { z } from "zod";

const baseVideoSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  image: z.union([z.string(), z.instanceof(ArrayBuffer, {})]).optional(),
  abortSignal: z.instanceof(AbortSignal, {}).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const klingV25Schema = baseVideoSchema.extend({
  duration: z
    .union([z.literal(5), z.literal(10)])
    .optional()
    .default(5),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
});

export const klingV2Schema = baseVideoSchema.extend({
  duration: z
    .union([z.literal(5), z.literal(10)])
    .optional()
    .default(5),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
});

export const klingV15Schema = baseVideoSchema.extend({
  duration: z
    .union([z.literal(5), z.literal(10)])
    .optional()
    .default(5),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
});

export const wanSchema = baseVideoSchema.extend({
  duration: z.number().min(1).max(5).optional().default(5),
  resolution: z.enum(["480p", "720p"]).optional().default("480p"),
});

export const minimaxSchema = baseVideoSchema.extend({
  duration: z.number().min(1).max(6).optional().default(5),
});

export const FAL_VIDEO_SCHEMAS: Record<string, z.ZodSchema> = {
  "kling-v2.5": klingV25Schema,
  "kling-v2": klingV2Schema,
  "kling-v1.5": klingV15Schema,
  "wan-2.5": wanSchema,
  minimax: minimaxSchema,
};

export type KlingV25Options = z.infer<typeof klingV25Schema>;
export type KlingV2Options = z.infer<typeof klingV2Schema>;
export type KlingV15Options = z.infer<typeof klingV15Schema>;
export type WanOptions = z.infer<typeof wanSchema>;
export type MinimaxOptions = z.infer<typeof minimaxSchema>;

export type FalVideoOptions =
  | KlingV25Options
  | KlingV2Options
  | KlingV15Options
  | WanOptions
  | MinimaxOptions;
