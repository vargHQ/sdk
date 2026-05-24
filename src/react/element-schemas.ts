/**
 * Element schemas for the visual studio.
 *
 * One Zod schema per `VargElementType`, mirroring the prop interfaces from
 * `./types.ts`. This is the single source of truth used by:
 *
 *   - the studio param panel (auto-rendered forms)
 *   - the codegen / parser (which props to emit and capture)
 *   - port discovery (which prop slots accept upstream element outputs)
 *
 * Notes
 * -----
 * - Schemas use `.passthrough()` so advanced provider-specific fields are
 *   never dropped on round-trip — the form panel only renders known fields,
 *   but unknown ones survive load → save.
 * - The `model` prop is intentionally typed as a free-form `{ id, provider }`
 *   reference so the schema does not depend on a specific runtime model
 *   instance (those are constructed only when running TSX).
 * - "Ports" describe which prop paths can be connected from another node's
 *   output (e.g. `Image -> Video.prompt.images[0]`). Ports drive the canvas
 *   connection rules and the codegen rendering (an edge into a port causes
 *   the producer element to be inlined at that prop path).
 */

import { z } from "zod";
import {
  aspectRatioSchema,
  imageSizeSchema,
  resolutionSchema,
  voiceSchema,
} from "../core/schema/shared";
import type { VargElementType } from "./types";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Free-form model reference (decoupled from runtime model instances). */
const modelRefSchema = z
  .object({
    /** Provider name, e.g. "fal", "elevenlabs", "magnific". */
    provider: z.string(),
    /** Model id understood by the provider, e.g. "flux-schnell", "kling-v2.5". */
    id: z.string(),
  })
  .strict()
  .describe("Reference to an AI model: { provider, id }");

const sizeValueSchema = z.union([z.number(), z.string()]);
const positionSchema = z.union([
  z.enum([
    "top",
    "bottom",
    "left",
    "right",
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]),
  z
    .object({
      x: z.union([z.number(), z.string()]).optional(),
      y: z.union([z.number(), z.string()]).optional(),
      originX: z.string().optional(),
      originY: z.string().optional(),
    })
    .strict(),
]);

const resizeModeSchema = z
  .enum(["cover", "contain", "stretch", "fit"])
  .describe("How the asset is fit into the canvas");

// ---------------------------------------------------------------------------
// Per-element schemas (only static / serialisable props)
// ---------------------------------------------------------------------------

const renderProps = z
  .object({
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1920),
    fps: z.number().int().positive().default(30),
    normalize: z.boolean().optional(),
    shortest: z.boolean().optional(),
  })
  .passthrough();

const clipProps = z
  .object({
    duration: z.union([z.number(), z.literal("auto")]).optional(),
    cutFrom: z.number().optional(),
    cutTo: z.number().optional(),
  })
  .passthrough();

const overlayProps = z
  .object({
    left: sizeValueSchema.optional(),
    top: sizeValueSchema.optional(),
    width: sizeValueSchema.optional(),
    height: sizeValueSchema.optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    volume: z.number().min(0).max(1).optional(),
    keepAudio: z.boolean().optional(),
  })
  .passthrough();

/**
 * Image/Video prompts may be a plain string or an object `{ text, images?, ... }`.
 * The visual editor renders only the `text` field; the `images`/`video`/`audio`
 * slots are realised as ports and extracted into edges by the parser.
 */
const imagePromptSchema = z.union([
  z.string(),
  z
    .object({
      text: z.string().optional(),
      // images is intentionally permissive — its serialisable items are
      // strings/URLs/byte arrays; element items are extracted into edges.
      images: z.array(z.unknown()).optional(),
    })
    .passthrough(),
]);

const videoPromptSchema = z.union([
  z.string(),
  z
    .object({
      text: z.string().optional(),
      images: z.array(z.unknown()).optional(),
      video: z.unknown().optional(),
      audio: z.unknown().optional(),
    })
    .passthrough(),
]);

const imageProps = z
  .object({
    /** Prompt text. The `images` slot is a port, not a form field. */
    prompt: imagePromptSchema.optional(),
    src: z.string().optional(),
    model: modelRefSchema.optional(),
    aspectRatio: z
      .string()
      .regex(/^\d+:\d+$/)
      .optional(),
    imageSize: imageSizeSchema.optional(),
    zoom: z.enum(["in", "out", "left", "right"]).optional(),
    resize: resizeModeSchema.optional(),
    position: positionSchema.optional(),
    removeBackground: z.boolean().optional(),
    providerOptions: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const videoProps = z
  .object({
    /** Prompt text. The `images`, `video`, `audio` slots are ports. */
    prompt: videoPromptSchema.optional(),
    src: z.string().optional(),
    model: modelRefSchema.optional(),
    aspectRatio: aspectRatioSchema.optional(),
    resize: resizeModeSchema.optional(),
    position: positionSchema.optional(),
    duration: z.number().optional(),
    cutFrom: z.number().optional(),
    cutTo: z.number().optional(),
    volume: z.number().min(0).max(1).optional(),
    keepAudio: z.boolean().optional(),
    providerOptions: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const speechProps = z
  .object({
    /** Text content. Strings or array of segments. */
    text: z.union([z.string(), z.array(z.string())]).optional(),
    voice: voiceSchema.optional(),
    model: modelRefSchema.optional(),
    id: z.string().optional(),
    volume: z.number().min(0).max(1).optional(),
  })
  .passthrough();

const talkingHeadProps = z
  .object({
    model: modelRefSchema.optional(),
    lipsyncModel: modelRefSchema.optional(),
    resolution: resolutionSchema.optional(),
    position: positionSchema.optional(),
    size: z
      .object({ width: z.string(), height: z.string() })
      .strict()
      .optional(),
  })
  .passthrough();

const titleProps = z
  .object({
    text: z.string().optional(),
    position: positionSchema.optional(),
    color: z.string().optional(),
    fontPath: z.string().optional(),
    fontFamily: z.string().optional(),
    outline: z.number().optional(),
    outlineColor: z.string().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
  })
  .passthrough();

const subtitleProps = z
  .object({
    text: z.string().optional(),
    backgroundColor: z.string().optional(),
  })
  .passthrough();

const musicProps = z
  .object({
    prompt: z.string().optional(),
    src: z.string().optional(),
    model: modelRefSchema.optional(),
    start: z.number().optional(),
    loop: z.boolean().optional(),
    ducking: z.boolean().optional(),
    duration: z.number().optional(),
    cutFrom: z.number().optional(),
    cutTo: z.number().optional(),
    volume: z.number().min(0).max(1).optional(),
  })
  .passthrough();

const captionsProps = z
  .object({
    srt: z.string().optional(),
    style: z.enum(["tiktok", "karaoke", "bounce", "typewriter"]).optional(),
    position: z.enum(["top", "center", "bottom"]).optional(),
    color: z.string().optional(),
    activeColor: z.string().optional(),
    fontSize: z.number().optional(),
    wordsPerLine: z.number().int().positive().optional(),
    withAudio: z.boolean().optional(),
    font: z.string().optional(),
  })
  .passthrough();

const splitProps = z
  .object({
    direction: z.enum(["horizontal", "vertical"]).optional(),
  })
  .passthrough();

const sliderProps = z
  .object({
    direction: z.enum(["horizontal", "vertical"]).optional(),
  })
  .passthrough();

const swipeProps = z
  .object({
    direction: z.enum(["left", "right", "up", "down"]).optional(),
    interval: z.number().optional(),
  })
  .passthrough();

const packshotProps = z
  .object({
    background: z.string().optional(), // string fill — element bg via port
    logoPosition: positionSchema.optional(),
    logoSize: sizeValueSchema.optional(),
    title: z.string().optional(),
    titleColor: z.string().optional(),
    titlePosition: positionSchema.optional(),
    cta: z.string().optional(),
    ctaPosition: positionSchema.optional(),
    ctaColor: z.string().optional(),
    ctaTextColor: z.string().optional(),
    ctaSize: z
      .object({ width: z.number(), height: z.number() })
      .strict()
      .optional(),
    blinkCta: z.boolean().optional(),
    blinkFrequency: z.number().optional(),
    duration: z.number().optional(),
  })
  .passthrough();

const sliceProps = z
  .object({
    src: z.string().optional(),
    codec: z.enum(["copy", "reencode"]).optional(),
    every: z.number().optional(),
    at: z.array(z.number()).optional(),
    count: z.number().int().positive().optional(),
    ranges: z
      .array(z.object({ start: z.number(), end: z.number() }).strict())
      .optional(),
  })
  .passthrough();

const ffmpegProps = z
  .object({
    src: z.string().optional(),
    command: z.string(),
    inputs: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const probeProps = z
  .object({
    src: z.string().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Port descriptors
// ---------------------------------------------------------------------------

export type MediaKind = "image" | "video" | "audio" | "any";

export interface InPort {
  /** Dotted path inside `props` where the producer element is inlined. */
  path: string;
  /** Allowed producer output kind. */
  accepts: MediaKind;
  /** Human label for the UI. */
  label: string;
  /** True for repeated/array slots (e.g. video.prompt.images[]). */
  multiple?: boolean;
}

export interface OutPort {
  /** What this element produces when resolved. */
  kind: MediaKind;
}

export type ElementCategory =
  | "layout"
  | "ai"
  | "asset"
  | "captions"
  | "processing";

export interface ElementSchema {
  /** Zod schema for the static / serialisable props of this element. */
  props: z.ZodTypeAny;
  /** UI grouping. */
  category: ElementCategory;
  /** Whether this element can contain child elements. */
  container: boolean;
  /** Whether the element accepts other elements via typed prop slots. */
  ports: { in: InPort[]; out: OutPort | null };
  /** Human label / icon for the palette. */
  label: string;
  icon: string;
  /** Short description for the palette. */
  description: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const elementSchemas: Record<VargElementType, ElementSchema> = {
  render: {
    props: renderProps,
    category: "layout",
    container: true,
    ports: { in: [], out: null },
    label: "Render",
    icon: "▢",
    description: "Root canvas: dimensions, fps, contains clips",
  },
  clip: {
    props: clipProps,
    category: "layout",
    container: true,
    ports: { in: [], out: null },
    label: "Clip",
    icon: "⌗",
    description: "Timeline segment with duration & transitions",
  },
  overlay: {
    props: overlayProps,
    category: "layout",
    container: true,
    ports: { in: [], out: null },
    label: "Overlay",
    icon: "⊕",
    description: "Positioned layer inside a clip",
  },
  image: {
    props: imageProps,
    category: "ai",
    container: false,
    ports: {
      in: [
        {
          path: "prompt.images",
          accepts: "image",
          label: "reference images",
          multiple: true,
        },
      ],
      out: { kind: "image" },
    },
    label: "Image",
    icon: "🖼",
    description: "Generate an image from text + optional reference images",
  },
  video: {
    props: videoProps,
    category: "ai",
    container: false,
    ports: {
      in: [
        {
          path: "prompt.images",
          accepts: "image",
          label: "reference images",
          multiple: true,
        },
        { path: "prompt.video", accepts: "video", label: "reference video" },
        { path: "prompt.audio", accepts: "audio", label: "audio track" },
      ],
      out: { kind: "video" },
    },
    label: "Video",
    icon: "🎬",
    description: "Generate a video from text / image / video / audio",
  },
  speech: {
    props: speechProps,
    category: "ai",
    container: false,
    ports: { in: [], out: { kind: "audio" } },
    label: "Speech",
    icon: "🗣",
    description: "Text-to-speech (single or segmented)",
  },
  "talking-head": {
    props: talkingHeadProps,
    category: "ai",
    container: false,
    ports: {
      in: [
        { path: "image", accepts: "image", label: "character" },
        { path: "audio", accepts: "audio", label: "voice track" },
      ],
      out: { kind: "video" },
    },
    label: "Talking Head",
    icon: "👤",
    description: "Lip-sync an image to a speech track",
  },
  title: {
    props: titleProps,
    category: "captions",
    container: false,
    ports: { in: [], out: null },
    label: "Title",
    icon: "T",
    description: "On-screen title text",
  },
  subtitle: {
    props: subtitleProps,
    category: "captions",
    container: false,
    ports: { in: [], out: null },
    label: "Subtitle",
    icon: "t",
    description: "Bottom subtitle text",
  },
  music: {
    props: musicProps,
    category: "ai",
    container: false,
    ports: { in: [], out: { kind: "audio" } },
    label: "Music",
    icon: "🎵",
    description: "Generate background music",
  },
  captions: {
    props: captionsProps,
    category: "captions",
    container: false,
    ports: {
      in: [{ path: "src", accepts: "audio", label: "speech track" }],
      out: null,
    },
    label: "Captions",
    icon: "💬",
    description: "Animated captions from a speech track or SRT",
  },
  split: {
    props: splitProps,
    category: "layout",
    container: true,
    ports: { in: [], out: null },
    label: "Split",
    icon: "▥",
    description: "Split-screen container",
  },
  slider: {
    props: sliderProps,
    category: "layout",
    container: true,
    ports: { in: [], out: null },
    label: "Slider",
    icon: "▤",
    description: "Animated slider between children",
  },
  swipe: {
    props: swipeProps,
    category: "layout",
    container: true,
    ports: { in: [], out: null },
    label: "Swipe",
    icon: "↔",
    description: "Swipe-through carousel of children",
  },
  packshot: {
    props: packshotProps,
    category: "layout",
    container: false,
    ports: {
      in: [
        { path: "background", accepts: "any", label: "background" },
        { path: "logo", accepts: "image", label: "logo" },
      ],
      out: null,
    },
    label: "Packshot",
    icon: "✦",
    description: "End-card with logo, CTA, title",
  },
  slice: {
    props: sliceProps,
    category: "processing",
    container: false,
    ports: {
      in: [{ path: "src", accepts: "video", label: "source video" }],
      out: { kind: "video" },
    },
    label: "Slice",
    icon: "✂",
    description: "Slice a video into segments",
  },
  ffmpeg: {
    props: ffmpegProps,
    category: "processing",
    container: false,
    ports: {
      in: [{ path: "src", accepts: "any", label: "source" }],
      out: { kind: "any" },
    },
    label: "FFmpeg",
    icon: "⚙",
    description: "Arbitrary FFmpeg command",
  },
  probe: {
    props: probeProps,
    category: "processing",
    container: false,
    ports: {
      in: [{ path: "src", accepts: "any", label: "source" }],
      out: null,
    },
    label: "Probe",
    icon: "ℹ",
    description: "Inspect a media file's metadata",
  },
  __lazy: {
    // Internal — never instantiated in a graph.
    props: z.object({}).passthrough(),
    category: "processing",
    container: false,
    ports: { in: [], out: null },
    label: "(lazy)",
    icon: "·",
    description: "Internal placeholder, not user-facing",
  },
};

/**
 * Returns every element type the visual editor should expose in its palette.
 * Filters out internal placeholders (`__lazy`).
 */
export function listElementTypes(): VargElementType[] {
  return (Object.keys(elementSchemas) as VargElementType[]).filter(
    (t) => t !== "__lazy",
  );
}

/**
 * Group element types by category for palette rendering.
 */
export function elementsByCategory(): Record<
  ElementCategory,
  VargElementType[]
> {
  const out: Record<ElementCategory, VargElementType[]> = {
    layout: [],
    ai: [],
    asset: [],
    captions: [],
    processing: [],
  };
  for (const t of listElementTypes()) {
    out[elementSchemas[t].category].push(t);
  }
  return out;
}

/**
 * Returns the InPort descriptor at a given dotted path (or null).
 * Used by codegen to know whether an edge target is a known port.
 */
export function getInPort(type: VargElementType, path: string): InPort | null {
  return elementSchemas[type].ports.in.find((p) => p.path === path) ?? null;
}
