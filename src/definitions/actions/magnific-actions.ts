/**
 * Magnific CLI actions — short verbs that map 1:1 to Magnific capabilities.
 *
 * Each action's Zod input schema mirrors the underlying Magnific endpoint
 * schema verbatim (every field, every default, every enum). The `execute`
 * function calls `magnificProvider` directly — Layer B always uses BYOK
 * (`MAGNIFIC_API_KEY`).
 *
 * Actions:
 *   - upscale         (creative + precision modes)
 *   - relight
 *   - restyle         (style transfer)
 *   - remove-bg
 *   - expand
 *   - sfx             (sound effects)
 *   - isolate-audio
 *   - vfx             (video filters)
 */

import { z } from "zod";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { magnificProvider } from "../../providers/magnific";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const urlOrPathSchema = z
  .string()
  .describe("URL or local file path (encoded as base64 by the SDK)");

const singleUrlOutput = z.object({ url: z.string() });
type SingleUrlOutput = typeof singleUrlOutput;

async function readBase64(input: string): Promise<string> {
  if (/^https?:\/\//i.test(input)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let r: Response;
    try {
      r = await fetch(input, { signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`fetch timed out for ${input}`);
      }
      throw err;
    }
    clearTimeout(timer);
    if (!r.ok) {
      throw new Error(`failed to fetch ${input}: ${r.status}`);
    }
    return Buffer.from(await r.arrayBuffer()).toString("base64");
  }
  // local file — Bun.file gives us an arrayBuffer
  const file = Bun.file(input);
  if (!(await file.exists())) {
    throw new Error(`file not found: ${input}`);
  }
  return Buffer.from(await file.arrayBuffer()).toString("base64");
}

// ---------------------------------------------------------------------------
// upscale
// ---------------------------------------------------------------------------

const upscaleInput = z.object({
  image: urlOrPathSchema,
  mode: z
    .enum(["creative", "precision"])
    .default("creative")
    .describe("Upscaler engine"),
  // Creative-mode fields
  scale_factor: z.enum(["2x", "4x", "8x", "16x"]).default("2x"),
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
    .default("standard"),
  prompt: z.string().optional(),
  creativity: z.number().int().min(-10).max(10).default(0),
  hdr: z.number().int().min(-10).max(10).default(0),
  resemblance: z.number().int().min(-10).max(10).default(0),
  fractality: z.number().int().min(-10).max(10).default(0),
  engine: z
    .enum([
      "automatic",
      "magnific_illusio",
      "magnific_sharpy",
      "magnific_sparkle",
    ])
    .default("automatic"),
  // Precision-mode fields
  sharpen: z.number().int().min(0).max(100).default(50),
  smart_grain: z.number().int().min(0).max(100).default(7),
  ultra_detail: z.number().int().min(0).max(100).default(30),
  // Common
  filter_nsfw: z.boolean().default(false),
  webhook_url: z.string().url().optional(),
});

export const upscaleDefinition: ActionDefinition<
  ZodSchema<typeof upscaleInput, SingleUrlOutput>
> = {
  type: "action",
  name: "upscale",
  description: "Upscale an image using Magnific (creative or precision mode).",
  schema: { input: upscaleInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) => {
    const image = await readBase64(inputs.image);
    if (inputs.mode === "precision") {
      return magnificProvider.upscalePrecision({
        image,
        sharpen: inputs.sharpen,
        smart_grain: inputs.smart_grain,
        ultra_detail: inputs.ultra_detail,
        filter_nsfw: inputs.filter_nsfw,
        webhook_url: inputs.webhook_url,
      });
    }
    return magnificProvider.upscaleCreative({
      image,
      scale_factor: inputs.scale_factor,
      optimized_for: inputs.optimized_for,
      prompt: inputs.prompt,
      creativity: inputs.creativity,
      hdr: inputs.hdr,
      resemblance: inputs.resemblance,
      fractality: inputs.fractality,
      engine: inputs.engine,
      filter_nsfw: inputs.filter_nsfw,
      webhook_url: inputs.webhook_url,
    });
  },
};

// ---------------------------------------------------------------------------
// relight
// ---------------------------------------------------------------------------

const relightAdvanced = z
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
  .partial();

const relightInput = z.object({
  image: urlOrPathSchema,
  prompt: z.string().optional(),
  reference_image: urlOrPathSchema.optional(),
  lightmap: urlOrPathSchema.optional(),
  light_transfer_strength: z.number().int().min(0).max(100).default(100),
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
    .default("standard"),
  preserve_details: z.boolean().default(true),
  advanced_settings: relightAdvanced.optional(),
  webhook_url: z.string().url().optional(),
});

export const relightDefinition: ActionDefinition<
  ZodSchema<typeof relightInput, SingleUrlOutput>
> = {
  type: "action",
  name: "relight",
  description:
    "Change the lighting of an image via prompt, reference image, or custom lightmap.",
  schema: { input: relightInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) => {
    if (inputs.reference_image && inputs.lightmap) {
      throw new Error(
        "relight: pass either --reference-image OR --lightmap, not both",
      );
    }
    return magnificProvider.relight({
      image: await readBase64(inputs.image),
      prompt: inputs.prompt,
      transfer_light_from_reference_image: inputs.reference_image
        ? await readBase64(inputs.reference_image)
        : undefined,
      transfer_light_from_lightmap: inputs.lightmap
        ? await readBase64(inputs.lightmap)
        : undefined,
      light_transfer_strength: inputs.light_transfer_strength,
      interpolate_from_original: inputs.interpolate_from_original,
      change_background: inputs.change_background,
      style: inputs.style,
      preserve_details: inputs.preserve_details,
      advanced_settings: inputs.advanced_settings,
      webhook_url: inputs.webhook_url,
    });
  },
};

// ---------------------------------------------------------------------------
// restyle (style transfer)
// ---------------------------------------------------------------------------

const restyleInput = z.object({
  image: urlOrPathSchema,
  reference_image: urlOrPathSchema,
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
  webhook_url: z.string().url().optional(),
});

export const restyleDefinition: ActionDefinition<
  ZodSchema<typeof restyleInput, SingleUrlOutput>
> = {
  type: "action",
  name: "restyle",
  description:
    "Apply a reference image's style to a source image (Magnific Style Transfer).",
  schema: { input: restyleInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) =>
    magnificProvider.styleTransfer({
      image: await readBase64(inputs.image),
      reference_image: await readBase64(inputs.reference_image),
      prompt: inputs.prompt,
      style_strength: inputs.style_strength,
      structure_strength: inputs.structure_strength,
      is_portrait: inputs.is_portrait,
      portrait_style: inputs.portrait_style,
      portrait_beautifier: inputs.portrait_beautifier,
      flavor: inputs.flavor,
      engine: inputs.engine,
      fixed_generation: inputs.fixed_generation,
      webhook_url: inputs.webhook_url,
    }),
};

// ---------------------------------------------------------------------------
// remove-bg
// ---------------------------------------------------------------------------

const removeBgInput = z.object({
  image_url: z
    .string()
    .url()
    .describe("Publicly accessible URL of the source image (JPG/PNG ≤20MB)"),
});

export const removeBgDefinition: ActionDefinition<
  ZodSchema<typeof removeBgInput, SingleUrlOutput>
> = {
  type: "action",
  name: "remove-bg",
  description:
    "Remove image background (Magnific Beta — synchronous, requires a URL input).",
  schema: { input: removeBgInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) =>
    magnificProvider.removeBackground({ image_url: inputs.image_url }),
};

// ---------------------------------------------------------------------------
// expand
// ---------------------------------------------------------------------------

const expandInput = z.object({
  image: urlOrPathSchema,
  prompt: z.string().optional(),
  left: z.number().int().min(0).max(2048).optional(),
  right: z.number().int().min(0).max(2048).optional(),
  top: z.number().int().min(0).max(2048).optional(),
  bottom: z.number().int().min(0).max(2048).optional(),
  webhook_url: z.string().url().optional(),
});

export const expandDefinition: ActionDefinition<
  ZodSchema<typeof expandInput, SingleUrlOutput>
> = {
  type: "action",
  name: "expand",
  description: "Outpaint an image (Magnific Image Expand / Flux Pro).",
  schema: { input: expandInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) =>
    magnificProvider.expand({
      image: await readBase64(inputs.image),
      prompt: inputs.prompt,
      left: inputs.left,
      right: inputs.right,
      top: inputs.top,
      bottom: inputs.bottom,
      webhook_url: inputs.webhook_url,
    }),
};

// ---------------------------------------------------------------------------
// sfx (sound effects)
// ---------------------------------------------------------------------------

const sfxInput = z.object({
  text: z.string().max(2500).describe("Effect description"),
  duration_seconds: z.number().min(0.5).max(22),
  loop: z.boolean().default(false),
  prompt_influence: z.number().min(0).max(1).default(0.3),
  webhook_url: z.string().url().optional(),
});

export const sfxDefinition: ActionDefinition<
  ZodSchema<typeof sfxInput, SingleUrlOutput>
> = {
  type: "action",
  name: "sfx",
  description: "Generate a sound effect from a text description (Magnific).",
  schema: { input: sfxInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) =>
    magnificProvider.soundEffects({
      text: inputs.text,
      duration_seconds: inputs.duration_seconds,
      loop: inputs.loop,
      prompt_influence: inputs.prompt_influence,
      webhook_url: inputs.webhook_url,
    }),
};

// ---------------------------------------------------------------------------
// isolate-audio
// ---------------------------------------------------------------------------

const isolateAudioInput = z
  .object({
    description: z.string().max(2500),
    audio: urlOrPathSchema.optional(),
    video: urlOrPathSchema.optional(),
    x1: z.number().int().min(0).default(0),
    y1: z.number().int().min(0).default(0),
    x2: z.number().int().min(0).default(0),
    y2: z.number().int().min(0).default(0),
    sample_fps: z.number().min(1).max(5).default(2),
    reranking_candidates: z.number().int().min(1).max(8).default(1),
    predict_spans: z.boolean().default(false),
    webhook_url: z.string().url().optional(),
  })
  .refine((v) => Boolean(v.audio) !== Boolean(v.video), {
    message: "exactly one of `audio` or `video` is required",
  });

export const isolateAudioDefinition: ActionDefinition<
  ZodSchema<typeof isolateAudioInput, SingleUrlOutput>
> = {
  type: "action",
  name: "isolate-audio",
  description:
    "Isolate a described sound from an audio or video input (Magnific Audio Isolation).",
  schema: { input: isolateAudioInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) => {
    const audio = inputs.audio
      ? /^https?:\/\//i.test(inputs.audio)
        ? inputs.audio
        : await readBase64(inputs.audio)
      : undefined;
    const video = inputs.video
      ? /^https?:\/\//i.test(inputs.video)
        ? inputs.video
        : await readBase64(inputs.video)
      : undefined;
    return magnificProvider.audioIsolation({
      description: inputs.description,
      audio,
      video,
      x1: inputs.x1,
      y1: inputs.y1,
      x2: inputs.x2,
      y2: inputs.y2,
      sample_fps: inputs.sample_fps,
      reranking_candidates: inputs.reranking_candidates,
      predict_spans: inputs.predict_spans,
      webhook_url: inputs.webhook_url,
    });
  },
};

// ---------------------------------------------------------------------------
// vfx (video filters)
// ---------------------------------------------------------------------------

const vfxInput = z.object({
  video: z.string().url().describe("Publicly accessible video URL"),
  filter_type: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(1)
    .describe(
      "Effect type 1=film grain, 2=motion blur, 3..6, 7=bloom, 8=anamorphic",
    ),
  fps: z.number().int().min(1).max(60).default(24),
  bloom_filter_contrast: z.number().optional(),
  motion_filter_kernel_size: z.number().int().optional(),
  motion_filter_decay_factor: z.number().optional(),
  webhook_url: z.string().url().optional(),
});

export const vfxDefinition: ActionDefinition<
  ZodSchema<typeof vfxInput, SingleUrlOutput>
> = {
  type: "action",
  name: "vfx",
  description: "Apply a video filter (Magnific VFX — 1 of 8 effect types).",
  schema: { input: vfxInput, output: singleUrlOutput },
  routes: [],
  execute: async (inputs) =>
    magnificProvider.vfx({
      video: inputs.video,
      filter_type: inputs.filter_type,
      fps: inputs.fps,
      bloom_filter_contrast: inputs.bloom_filter_contrast,
      motion_filter_kernel_size: inputs.motion_filter_kernel_size,
      motion_filter_decay_factor: inputs.motion_filter_decay_factor,
      webhook_url: inputs.webhook_url,
    }),
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export const allMagnificActionDefinitions = [
  upscaleDefinition,
  relightDefinition,
  restyleDefinition,
  removeBgDefinition,
  expandDefinition,
  sfxDefinition,
  isolateAudioDefinition,
  vfxDefinition,
];
