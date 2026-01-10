import { z } from "zod";

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
  n: z.number().min(1).max(4).optional().default(1),
  abortSignal: z.instanceof(AbortSignal, {}).optional(),
  providerOptions: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
});

const imageSizeSchema = z.enum([
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
]);

export const fluxProSchema = baseImageSchema.extend({
  size: imageSizeSchema.optional().default("landscape_16_9"),
  seed: z.number().optional(),
  guidance_scale: z.number().min(1).max(20).optional(),
  num_inference_steps: z.number().min(1).max(50).optional(),
  safety_tolerance: z.enum(["1", "2", "3", "4", "5", "6"]).optional(),
});

export const fluxDevSchema = baseImageSchema.extend({
  size: imageSizeSchema.optional().default("landscape_16_9"),
  seed: z.number().optional(),
  guidance_scale: z.number().min(1).max(20).optional().default(3.5),
  num_inference_steps: z.number().min(1).max(50).optional().default(28),
});

export const fluxSchnellSchema = baseImageSchema.extend({
  size: imageSizeSchema.optional().default("landscape_16_9"),
  seed: z.number().optional(),
  num_inference_steps: z.number().min(1).max(12).optional().default(4),
});

export const recraftV3Schema = baseImageSchema.extend({
  size: imageSizeSchema.optional().default("landscape_16_9"),
  style: z
    .enum([
      "any",
      "realistic_image",
      "digital_illustration",
      "vector_illustration",
      "realistic_image/b_and_w",
      "realistic_image/hard_flash",
      "realistic_image/hdr",
      "realistic_image/natural_light",
      "realistic_image/studio_portrait",
      "realistic_image/enterprise",
      "realistic_image/motion_blur",
    ])
    .optional(),
});

export const FAL_IMAGE_SCHEMAS: Record<string, z.ZodSchema> = {
  "flux-pro": fluxProSchema,
  "flux-dev": fluxDevSchema,
  "flux-schnell": fluxSchnellSchema,
  "recraft-v3": recraftV3Schema,
};

export type FluxProOptions = z.infer<typeof fluxProSchema>;
export type FluxDevOptions = z.infer<typeof fluxDevSchema>;
export type FluxSchnellOptions = z.infer<typeof fluxSchnellSchema>;
export type RecraftV3Options = z.infer<typeof recraftV3Schema>;

export type FalImageOptions =
  | FluxProOptions
  | FluxDevOptions
  | FluxSchnellOptions
  | RecraftV3Options;
