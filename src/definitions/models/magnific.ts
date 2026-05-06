/**
 * Magnific model definitions — every documented field on every endpoint is
 * declared in the Zod schema, with the correct default, enum, and range. The
 * action layer maps CLI flags 1:1 to these fields.
 *
 * The capability path is in `providerModels.magnific`; the Layer B provider
 * (`src/providers/magnific.ts`) routes to that path.
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// ---------------------------------------------------------------------------
// Shared enums + helpers
// ---------------------------------------------------------------------------

const aspectRatioImageSchema = z.enum([
  "square_1_1",
  "widescreen_16_9",
  "social_story_9_16",
  "portrait_2_3",
  "traditional_3_4",
  "vertical_1_2",
  "horizontal_2_1",
  "social_post_4_5",
  "standard_3_2",
  "classic_4_3",
  "cinematic_21_9",
]);

const colorWeightSchema = z.object({
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .describe("Hex color #RRGGBB"),
  weight: z.number().min(0.05).max(1.0).describe("Color weight 0.05–1.0"),
});

const stylingColorsSchema = z
  .array(colorWeightSchema)
  .min(1)
  .max(5)
  .describe("Dominant color palette (1–5 colors)");

const webhookUrlSchema = z
  .string()
  .url()
  .optional()
  .describe("Optional callback URL for async status notifications");

// Common output: a single URL.
const singleUrlOutput = z.object({
  url: z.string().describe("URL of the generated asset"),
  uploaded: z.string().optional().describe("Object key after R2 upload"),
});

// Some endpoints return multiple URLs (Mystic).
const multiUrlOutput = z.object({
  urls: z.array(z.string()),
  has_nsfw: z.array(z.boolean()).optional(),
});

// ---------------------------------------------------------------------------
// Image Upscaler — Creative
// ---------------------------------------------------------------------------

const upscaleCreativeInputSchema = z.object({
  image: z
    .string()
    .describe("Source image URL or local path (encoded as base64 by the SDK)"),
  scale_factor: z
    .enum(["2x", "4x", "8x", "16x"])
    .default("2x")
    .describe("Upscaling multiplier (output ≤25.3M pixels)"),
  optimized_for: z
    .enum([
      "standard",
      "soft_portraits",
      "hard_portraits",
      "art_n_illustration",
      "videogame_assets",
      "nature_n_landscapes",
      "films_n_photography",
      "3d_renders",
      "science_fiction_n_horror",
    ])
    .default("standard")
    .describe("Style optimization preset"),
  prompt: z
    .string()
    .optional()
    .describe(
      "Guidance prompt; reusing the original prompt improves AI-image upscales",
    ),
  creativity: z
    .number()
    .int()
    .min(-10)
    .max(10)
    .default(0)
    .describe("AI creativity level (-10..10)"),
  hdr: z
    .number()
    .int()
    .min(-10)
    .max(10)
    .default(0)
    .describe("Detail intensity (-10..10)"),
  resemblance: z
    .number()
    .int()
    .min(-10)
    .max(10)
    .default(0)
    .describe("Resemblance to original (-10..10)"),
  fractality: z
    .number()
    .int()
    .min(-10)
    .max(10)
    .default(0)
    .describe("Prompt strength per pixel (-10..10)"),
  engine: z
    .enum([
      "automatic",
      "magnific_illusio",
      "magnific_sharpy",
      "magnific_sparkle",
    ])
    .default("automatic")
    .describe("Magnific model engine"),
  filter_nsfw: z.boolean().default(false).describe("Filter NSFW content"),
  webhook_url: webhookUrlSchema,
});

const upscaleCreativeSchema: ZodSchema<
  typeof upscaleCreativeInputSchema,
  typeof singleUrlOutput
> = { input: upscaleCreativeInputSchema, output: singleUrlOutput };

export const magnificUpscaleCreativeDefinition: ModelDefinition<
  typeof upscaleCreativeSchema
> = {
  type: "model",
  name: "magnific/upscale-creative",
  description:
    "Magnific creative upscaler — prompt-guided 2x/4x/8x/16x upscaling with style presets and creativity controls.",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/image-upscaler" },
  schema: upscaleCreativeSchema,
};

// ---------------------------------------------------------------------------
// Image Upscaler — Precision
// ---------------------------------------------------------------------------

const upscalePrecisionInputSchema = z.object({
  image: z.string().describe("Source image URL or local path"),
  sharpen: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(50)
    .describe("Sharpening 0–100"),
  smart_grain: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(7)
    .describe("Smart grain 0–100"),
  ultra_detail: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(30)
    .describe("Ultra-detail 0–100"),
  filter_nsfw: z.boolean().default(false).describe("Filter NSFW content"),
  webhook_url: webhookUrlSchema,
});

const upscalePrecisionSchema: ZodSchema<
  typeof upscalePrecisionInputSchema,
  typeof singleUrlOutput
> = { input: upscalePrecisionInputSchema, output: singleUrlOutput };

export const magnificUpscalePrecisionDefinition: ModelDefinition<
  typeof upscalePrecisionSchema
> = {
  type: "model",
  name: "magnific/upscale-precision",
  description:
    "Magnific precision upscaler — high-fidelity sharpening, grain, and ultra-detail enhancement.",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/image-upscaler-precision" },
  schema: upscalePrecisionSchema,
};

// ---------------------------------------------------------------------------
// Image Relight
// ---------------------------------------------------------------------------

const relightAdvancedSchema = z
  .object({
    whites: z.number().int().min(0).max(100).default(50),
    blacks: z.number().int().min(0).max(100).default(50),
    brightness: z.number().int().min(0).max(100).default(50),
    contrast: z.number().int().min(0).max(100).default(50),
    saturation: z.number().int().min(0).max(100).default(50),
    engine: z
      .enum([
        "automatic",
        "balanced",
        "cool",
        "real",
        "illusio",
        "fairy",
        "colorful_anime",
        "hard_transform",
        "softy",
      ])
      .default("automatic"),
    transfer_light_a: z
      .enum(["automatic", "low", "medium", "normal", "high", "high_on_faces"])
      .default("automatic"),
    transfer_light_b: z
      .enum([
        "automatic",
        "composition",
        "straight",
        "smooth_in",
        "smooth_out",
        "smooth_both",
        "reverse_both",
        "soft_in",
        "soft_out",
        "soft_mid",
        "strong_mid",
        "style_shift",
        "strong_shift",
      ])
      .default("automatic"),
    fixed_generation: z.boolean().default(false),
  })
  .partial()
  .describe("Advanced relight controls (all optional)");

const relightInputSchema = z.object({
  image: z.string().describe("Source image (URL or base64)"),
  prompt: z
    .string()
    .optional()
    .describe("Guidance prompt; supports `(aspect:1-1.4)` syntax"),
  transfer_light_from_reference_image: z
    .string()
    .optional()
    .describe("Reference image (mutually exclusive with lightmap)"),
  transfer_light_from_lightmap: z
    .string()
    .optional()
    .describe("Custom lightmap (mutually exclusive with reference)"),
  light_transfer_strength: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(100)
    .describe("Transfer intensity 0–100"),
  interpolate_from_original: z.boolean().default(false),
  change_background: z.boolean().default(true),
  style: z
    .enum([
      "standard",
      "darker_but_realistic",
      "clean",
      "smooth",
      "brighter",
      "contrasted_n_hdr",
      "just_composition",
    ])
    .default("standard")
    .describe("Visual style preset"),
  preserve_details: z.boolean().default(true),
  advanced_settings: relightAdvancedSchema.optional(),
  webhook_url: webhookUrlSchema,
});

const relightSchema: ZodSchema<
  typeof relightInputSchema,
  typeof singleUrlOutput
> = {
  input: relightInputSchema,
  output: singleUrlOutput,
};

export const magnificRelightDefinition: ModelDefinition<typeof relightSchema> =
  {
    type: "model",
    name: "magnific/relight",
    description:
      "Magnific Relight — change image lighting via prompt, reference image, or custom lightmap.",
    providers: ["magnific"],
    defaultProvider: "magnific",
    providerModels: { magnific: "ai/image-relight" },
    schema: relightSchema,
  };

// ---------------------------------------------------------------------------
// Image Style Transfer
// ---------------------------------------------------------------------------

const styleTransferInputSchema = z.object({
  image: z.string().describe("Source image"),
  reference_image: z.string().describe("Style-reference image"),
  prompt: z.string().optional(),
  style_strength: z.number().int().min(0).max(100).default(100),
  structure_strength: z.number().int().min(0).max(100).default(50),
  is_portrait: z.boolean().default(false),
  portrait_style: z.enum(["standard", "pop", "super_pop"]).default("standard"),
  portrait_beautifier: z
    .enum(["beautify_face", "beautify_face_max"])
    .optional(),
  flavor: z
    .enum([
      "faithful",
      "gen_z",
      "psychedelia",
      "detaily",
      "clear",
      "donotstyle",
      "donotstyle_sharp",
    ])
    .default("faithful"),
  engine: z
    .enum([
      "balanced",
      "definio",
      "illusio",
      "3d_cartoon",
      "colorful_anime",
      "caricature",
      "real",
      "super_real",
      "softy",
    ])
    .default("balanced"),
  fixed_generation: z.boolean().default(false),
  webhook_url: webhookUrlSchema,
});

const styleTransferSchema: ZodSchema<
  typeof styleTransferInputSchema,
  typeof singleUrlOutput
> = { input: styleTransferInputSchema, output: singleUrlOutput };

export const magnificStyleTransferDefinition: ModelDefinition<
  typeof styleTransferSchema
> = {
  type: "model",
  name: "magnific/style-transfer",
  description:
    "Magnific Style Transfer — apply a reference image's style with engine + flavor controls.",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/image-style-transfer" },
  schema: styleTransferSchema,
};

// ---------------------------------------------------------------------------
// Remove Background (synchronous)
// ---------------------------------------------------------------------------

const removeBgInputSchema = z.object({
  image_url: z
    .string()
    .url()
    .describe(
      "Publicly accessible URL of the source image (JPG/PNG ≤20MB; preview ≤0.25MP, full ≤25MP)",
    ),
});

const removeBgSchema: ZodSchema<
  typeof removeBgInputSchema,
  typeof singleUrlOutput
> = { input: removeBgInputSchema, output: singleUrlOutput };

export const magnificRemoveBgDefinition: ModelDefinition<
  typeof removeBgSchema
> = {
  type: "model",
  name: "magnific/remove-bg",
  description:
    "Magnific background removal (synchronous endpoint, output URLs valid for 5 min).",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/beta/remove-background" },
  schema: removeBgSchema,
};

// ---------------------------------------------------------------------------
// Image Expand (Flux Pro outpaint)
// ---------------------------------------------------------------------------

const expandInputSchema = z.object({
  image: z.string().describe("Source image"),
  prompt: z.string().optional().describe("Expansion guidance"),
  left: z.number().int().min(0).max(2048).optional(),
  right: z.number().int().min(0).max(2048).optional(),
  top: z.number().int().min(0).max(2048).optional(),
  bottom: z.number().int().min(0).max(2048).optional(),
  webhook_url: webhookUrlSchema,
});

const expandSchema: ZodSchema<
  typeof expandInputSchema,
  typeof singleUrlOutput
> = {
  input: expandInputSchema,
  output: singleUrlOutput,
};

export const magnificExpandDefinition: ModelDefinition<typeof expandSchema> = {
  type: "model",
  name: "magnific/expand",
  description:
    "Magnific outpaint — extend image canvas (per-edge px controls).",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/image-expand/flux-pro" },
  schema: expandSchema,
};

// ---------------------------------------------------------------------------
// Mystic image generation
// ---------------------------------------------------------------------------

const mysticStylingSchema = z
  .object({
    styles: z
      .array(
        z.object({
          name: z.string().describe("Style name (from /v1/ai/loras)"),
          strength: z
            .number()
            .min(0)
            .max(200)
            .default(100)
            .describe("Style intensity 0–200"),
        }),
      )
      .max(1)
      .optional(),
    characters: z
      .array(
        z.object({
          id: z.string().describe("Character ID (from /v1/ai/loras)"),
          strength: z.number().min(0).max(200).default(100),
        }),
      )
      .max(1)
      .optional(),
    colors: stylingColorsSchema.optional(),
  })
  .partial()
  .describe("Mystic styling: styles, characters, colors");

const mysticInputSchema = z.object({
  prompt: z.string().optional().describe("Image description"),
  structure_reference: z
    .string()
    .optional()
    .describe("Base64 image to influence shape/structure"),
  structure_strength: z.number().int().min(0).max(100).default(50),
  style_reference: z
    .string()
    .optional()
    .describe("Base64 image to influence style"),
  adherence: z.number().int().min(0).max(100).default(50),
  hdr: z.number().int().min(0).max(100).default(50),
  resolution: z.enum(["1k", "2k", "4k"]).default("2k"),
  aspect_ratio: aspectRatioImageSchema.default("square_1_1"),
  model: z
    .enum([
      "zen",
      "flexible",
      "fluid",
      "realism",
      "super_real",
      "editorial_portraits",
    ])
    .default("realism"),
  creative_detailing: z.number().int().min(0).max(100).default(33),
  engine: z
    .enum([
      "automatic",
      "magnific_illusio",
      "magnific_sharpy",
      "magnific_sparkle",
    ])
    .default("automatic"),
  fixed_generation: z.boolean().default(false),
  filter_nsfw: z.boolean().default(true),
  styling: mysticStylingSchema.optional(),
  webhook_url: webhookUrlSchema,
});

const mysticSchema: ZodSchema<typeof mysticInputSchema, typeof multiUrlOutput> =
  {
    input: mysticInputSchema,
    output: multiUrlOutput,
  };

export const magnificMysticDefinition: ModelDefinition<typeof mysticSchema> = {
  type: "model",
  name: "magnific/mystic",
  description:
    "Magnific Mystic — flagship image generation with LoRAs and color palettes.",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/mystic" },
  schema: mysticSchema,
};

// ---------------------------------------------------------------------------
// VFX (video filters)
// ---------------------------------------------------------------------------

const vfxInputSchema = z.object({
  video: z.string().url().describe("Publicly accessible video URL"),
  filter_type: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(1)
    .describe("Effect type (1=film grain through 8=anamorphic lens)"),
  fps: z.number().int().min(1).max(60).default(24),
  bloom_filter_contrast: z
    .number()
    .optional()
    .describe("Glow intensity (filter_type=7 only)"),
  motion_filter_kernel_size: z
    .number()
    .int()
    .optional()
    .describe("Blur strength (filter_type=2 only)"),
  motion_filter_decay_factor: z
    .number()
    .optional()
    .describe("Blur falloff (filter_type=2 only)"),
  webhook_url: webhookUrlSchema,
});

const vfxSchema: ZodSchema<typeof vfxInputSchema, typeof singleUrlOutput> = {
  input: vfxInputSchema,
  output: singleUrlOutput,
};

export const magnificVfxDefinition: ModelDefinition<typeof vfxSchema> = {
  type: "model",
  name: "magnific/vfx",
  description:
    "Magnific VFX — apply 1 of 8 film/motion/anamorphic effects to a video.",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/video/vfx" },
  schema: vfxSchema,
};

// ---------------------------------------------------------------------------
// Audio: music, sound effects, audio isolation
// ---------------------------------------------------------------------------

const musicInputSchema = z.object({
  prompt: z
    .string()
    .max(2500)
    .describe("Genre/mood/instruments/tempo description"),
  music_length_seconds: z
    .number()
    .int()
    .min(10)
    .max(240)
    .describe("Track length 10–240s"),
  webhook_url: webhookUrlSchema,
});

const musicSchema: ZodSchema<typeof musicInputSchema, typeof singleUrlOutput> =
  {
    input: musicInputSchema,
    output: singleUrlOutput,
  };

export const magnificMusicDefinition: ModelDefinition<typeof musicSchema> = {
  type: "model",
  name: "magnific/music",
  description: "Magnific music generation (10–240s tracks).",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/music-generation" },
  schema: musicSchema,
};

const soundEffectsInputSchema = z.object({
  text: z.string().max(2500).describe("Effect description"),
  duration_seconds: z.number().min(0.5).max(22).describe("Length 0.5–22s"),
  loop: z.boolean().default(false),
  prompt_influence: z
    .number()
    .min(0)
    .max(1)
    .default(0.3)
    .describe("Prompt influence on output 0–1"),
  webhook_url: webhookUrlSchema,
});

const soundEffectsSchema: ZodSchema<
  typeof soundEffectsInputSchema,
  typeof singleUrlOutput
> = { input: soundEffectsInputSchema, output: singleUrlOutput };

export const magnificSoundEffectsDefinition: ModelDefinition<
  typeof soundEffectsSchema
> = {
  type: "model",
  name: "magnific/sound-effects",
  description: "Magnific sound effects generation (0.5–22s, optional looping).",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/sound-effects" },
  schema: soundEffectsSchema,
};

const audioIsolationInputSchema = z
  .object({
    description: z.string().max(2500).describe("Sound to isolate"),
    audio: z
      .string()
      .optional()
      .describe("Source audio URL or base64 (WAV/MP3/FLAC/OGG/M4A)"),
    video: z
      .string()
      .optional()
      .describe("Source video URL or base64 (MP4/MOV/WEBM/AVI)"),
    x1: z.number().int().min(0).default(0).describe("BBox left (video only)"),
    y1: z.number().int().min(0).default(0).describe("BBox top (video only)"),
    x2: z.number().int().min(0).default(0).describe("BBox right (video only)"),
    y2: z.number().int().min(0).default(0).describe("BBox bottom (video only)"),
    sample_fps: z
      .number()
      .min(1)
      .max(5)
      .default(2)
      .describe("Frame sampling rate 1–5"),
    reranking_candidates: z
      .number()
      .int()
      .min(1)
      .max(8)
      .default(1)
      .describe("Quality vs latency 1–8"),
    predict_spans: z.boolean().default(false),
    webhook_url: webhookUrlSchema,
  })
  .refine((v) => Boolean(v.audio) !== Boolean(v.video), {
    message: "exactly one of `audio` or `video` is required",
  });

const audioIsolationSchema: ZodSchema<
  typeof audioIsolationInputSchema,
  typeof singleUrlOutput
> = { input: audioIsolationInputSchema, output: singleUrlOutput };

export const magnificAudioIsolationDefinition: ModelDefinition<
  typeof audioIsolationSchema
> = {
  type: "model",
  name: "magnific/audio-isolation",
  description:
    "Magnific Audio Isolation — extract a described sound from audio or video.",
  providers: ["magnific"],
  defaultProvider: "magnific",
  providerModels: { magnific: "ai/audio-isolation" },
  schema: audioIsolationSchema,
};

// ---------------------------------------------------------------------------
// All Magnific unique-capability model definitions for index registration.
// ---------------------------------------------------------------------------

export const allMagnificDefinitions = [
  magnificUpscaleCreativeDefinition,
  magnificUpscalePrecisionDefinition,
  magnificRelightDefinition,
  magnificStyleTransferDefinition,
  magnificRemoveBgDefinition,
  magnificExpandDefinition,
  magnificMysticDefinition,
  magnificVfxDefinition,
  magnificMusicDefinition,
  magnificSoundEffectsDefinition,
  magnificAudioIsolationDefinition,
];
