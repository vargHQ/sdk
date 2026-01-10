import { z } from "zod";

const baseVideoSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  image: z.union([z.string(), z.instanceof(ArrayBuffer, {})]).optional(),
  duration: z.number().optional(),
  aspectRatio: z.string().optional(),
  abortSignal: z.instanceof(AbortSignal, {}).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const minimaxVideoSchema = baseVideoSchema.extend({
  prompt_optimizer: z.boolean().optional().default(true),
});

export const klingReplicateSchema = baseVideoSchema.extend({
  negative_prompt: z.string().optional(),
  cfg_scale: z.number().min(0).max(1).optional(),
});

export const ltxVideoSchema = baseVideoSchema.extend({
  negative_prompt: z.string().optional(),
  num_inference_steps: z.number().min(1).max(50).optional(),
});

export const REPLICATE_VIDEO_SCHEMAS: Record<string, z.ZodSchema> = {
  minimax: minimaxVideoSchema,
  "minimax-video-01": minimaxVideoSchema,
  kling: klingReplicateSchema,
  "kling-v1.5": klingReplicateSchema,
  luma: ltxVideoSchema,
  "ltx-video": ltxVideoSchema,
};

const baseImageSchema = z.object({
  prompt: z.union([
    z.string().min(1),
    z.object({
      text: z.string().min(1),
      images: z
        .array(z.union([z.string(), z.instanceof(ArrayBuffer, {})]))
        .optional(),
    }),
  ]),
  size: z.string().optional(),
  n: z.number().min(1).max(4).optional(),
  abortSignal: z.instanceof(AbortSignal, {}).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

export const fluxReplicateSchema = baseImageSchema.extend({
  guidance: z.number().min(1).max(10).optional(),
  num_inference_steps: z.number().min(1).max(50).optional(),
  seed: z.number().optional(),
});

export const sdxlSchema = baseImageSchema.extend({
  negative_prompt: z.string().optional(),
  guidance_scale: z.number().min(1).max(20).optional(),
  num_inference_steps: z.number().min(1).max(100).optional(),
  seed: z.number().optional(),
});

export const REPLICATE_IMAGE_SCHEMAS: Record<string, z.ZodSchema> = {
  "flux-pro": fluxReplicateSchema,
  "flux-dev": fluxReplicateSchema,
  "flux-schnell": fluxReplicateSchema,
  sdxl: sdxlSchema,
};

export type MinimaxVideoOptions = z.infer<typeof minimaxVideoSchema>;
export type KlingReplicateOptions = z.infer<typeof klingReplicateSchema>;
export type LtxVideoOptions = z.infer<typeof ltxVideoSchema>;
export type ReplicateVideoOptions =
  | MinimaxVideoOptions
  | KlingReplicateOptions
  | LtxVideoOptions;

export type FluxReplicateOptions = z.infer<typeof fluxReplicateSchema>;
export type SdxlOptions = z.infer<typeof sdxlSchema>;
export type ReplicateImageOptions = FluxReplicateOptions | SdxlOptions;
