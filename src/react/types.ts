import type {
  ImageModelV3,
  SharedV3ProviderOptions,
  SpeechModelV3,
  TranscriptionModelV3,
} from "@ai-sdk/provider";
import type { FFmpegBackend } from "@/ai-sdk/providers/editly/backends";
import type { CacheStorage } from "../ai-sdk/cache";
import type { File } from "../ai-sdk/file";
import type { MusicModelV3 } from "../ai-sdk/music-model";
import type {
  CropPosition,
  Position,
  ResizeMode,
  SizeValue,
  TransitionOptions,
} from "../ai-sdk/providers/editly/types";
import type { StorageProvider } from "../ai-sdk/storage/types";
import type { VideoModelV3 } from "../ai-sdk/video-model";
import type { Segment, WordTiming } from "../speech/types";

export type VargElementType =
  | "render"
  | "clip"
  | "overlay"
  | "image"
  | "video"
  | "speech"
  | "talking-head"
  | "title"
  | "subtitle"
  | "music"
  | "captions"
  | "split"
  | "slider"
  | "swipe"
  | "packshot"
  | "slice"
  | "ffmpeg"
  | "probe"
  | "__lazy";

/**
 * Metadata attached to a VargElement after it has been resolved via `await`.
 * Contains the generated file and probed media information.
 */
export interface ElementMeta {
  /** The generated file (image, video, audio) */
  file: File;
  /** Duration in seconds. 0 for images. Probed via ffprobe for audio/video. */
  duration: number;
  /** Aspect ratio of the generated media, if applicable (e.g. "9:16") */
  aspectRatio?: string;
  /**
   * Word-level timing data from ElevenLabs character alignment.
   * Available on speech elements when the provider returns alignment data.
   */
  words?: WordTiming[];
  /**
   * Segments — speech segments or video slice segments.
   * For Speech: each is a `Segment` (ResolvedElement<"speech"> with text/start/end).
   * For Slice: each is a `SliceSegment` (ResolvedElement<"video"> with url/index/start/end).
   */
  segments?: Segment[] | SliceSegment[];
}

export interface VargElement<T extends VargElementType = VargElementType> {
  type: T;
  props: Record<string, unknown>;
  children: VargNode[];
  /** Populated when the element has been resolved via `await` */
  meta?: ElementMeta;
}

export type VargNode =
  | VargElement
  | string
  | number
  | null
  | undefined
  | VargNode[];

export interface BaseProps {
  key?: string | number;
}

export interface PositionProps {
  left?: SizeValue;
  top?: SizeValue;
  width?: SizeValue;
  height?: SizeValue;
}

export interface VolumeProps {
  volume?: number;
}

export interface AudioProps extends VolumeProps {
  keepAudio?: boolean;
}

export type TrimProps =
  | { cutFrom?: number; cutTo?: number; duration?: never }
  | { cutFrom?: number; cutTo?: never; duration?: number };

// Root container - sets dimensions, fps, contains clips
export interface RenderProps extends BaseProps {
  width?: number;
  height?: number;
  fps?: number;
  normalize?: boolean;
  shortest?: boolean;
  children?: VargNode;
}

export interface ClipProps extends BaseProps {
  duration?: number | "auto";
  transition?: TransitionOptions;
  /** Start trim point in seconds (e.g., 1 to start from 1 second) */
  cutFrom?: number;
  /** End trim point in seconds (e.g., 3 to end at 3 seconds) */
  cutTo?: number;
  children?: VargNode;
}

export interface OverlayProps extends BaseProps, PositionProps, AudioProps {
  /** Start time in seconds (relative to parent clip). Only used when inside a <Clip>. */
  start?: number;
  /** End time in seconds (relative to parent clip). Only used when inside a <Clip>. */
  end?: number;
  children?: VargNode;
}

export type ImageInput = Uint8Array | string | VargElement<"image">;
export type ImagePrompt = string | { text?: string; images?: ImageInput[] };

export interface ImageProps extends BaseProps, PositionProps {
  prompt?: ImagePrompt;
  src?: string;
  model?: ImageModelV3;
  aspectRatio?: `${number}:${number}`;
  zoom?: "in" | "out" | "left" | "right";
  resize?: ResizeMode;
  cropPosition?: CropPosition;
  position?: Position;
  size?: { width: string; height: string };
  removeBackground?: boolean;
  /** Provider-specific options (e.g., fal: { acceleration: "high" }) */
  providerOptions?: SharedV3ProviderOptions;
}

export type VideoPrompt =
  | string
  | {
      text?: string;
      images?: ImageInput[];
      audio?: Uint8Array | string | VargElement<"speech">;
      video?: Uint8Array | string | VargElement<"video">;
    };

export type VideoProps = BaseProps &
  PositionProps &
  AudioProps &
  TrimProps & {
    prompt?: VideoPrompt;
    src?: string;
    model?: VideoModelV3;
    resize?: ResizeMode;
    cropPosition?: CropPosition;
    aspectRatio?: `${number}:${number}`;
    /** Provider-specific options (e.g., fal: { generate_audio: true }) */
    providerOptions?: SharedV3ProviderOptions;
  };

export interface SpeechProps extends BaseProps, VolumeProps {
  voice?: string;
  model?: SpeechModelV3;
  id?: string;
  /**
   * Text to convert to speech.
   *
   * - `string` — single text, generates one audio track.
   * - `string[]` — multiple segments, generates one audio track with word-level
   *   timing. The resolved element exposes `.segments` with per-entry start/end
   *   timestamps and lazy `.audio()` slicing.
   *
   * @example
   * ```tsx
   * // Single string
   * const audio = await Speech({ children: "Hello world" });
   *
   * // Array segments — one API call, segments computed from alignment
   * const audio = await Speech({
   *   children: ["Welcome.", "Main content.", "Thanks."]
   * });
   * audio.segments[0].duration  // 2.1
   * audio.segments[0].audio()   // Promise<Uint8Array> (ffmpeg slice)
   * ```
   */
  children?: string | string[];
}

export interface TalkingHeadProps extends BaseProps {
  /** Pre-resolved or lazy image element to use as the character face. */
  image?: VargElement<"image">;
  /** Pre-resolved or lazy speech element to use as the audio track. */
  audio?: VargElement<"speech">;
  /** Lipsync video model (e.g. fal.videoModel("sync-v2-pro")). */
  model?: VideoModelV3;
  /** Separate lipsync model override (defaults to `model`). */
  lipsyncModel?: VideoModelV3;
  /** Video resolution for lipsync generation (default: "720p") */
  resolution?: "480p" | "720p" | "1080p";
  position?:
    | Position
    | { left?: string; right?: string; top?: string; bottom?: string };
  size?: { width: string; height: string };
}

export interface TitleProps extends BaseProps {
  /** Title text. Alias for children — if both are provided, children takes precedence. */
  text?: string;
  position?: Position;
  color?: string;
  /** Path to a custom font file (.ttf, .otf) */
  fontPath?: string;
  /** System font family name (e.g. "Helvetica Neue", "Arial Black") */
  fontFamily?: string;
  outline?: number;
  outlineColor?: string;
  start?: number;
  end?: number;
  children?: string;
}

export interface SubtitleProps extends BaseProps {
  /** Subtitle text. Alias for children — if both are provided, children takes precedence. */
  text?: string;
  backgroundColor?: string;
  children?: string;
}

export type MusicProps = BaseProps &
  VolumeProps &
  TrimProps & {
    prompt?: string;
    model?: MusicModelV3;
    src?: string;
    /** Timeline offset in seconds — when in the video this audio starts playing */
    start?: number;
    loop?: boolean;
    ducking?: boolean;
  };

export interface CaptionsProps extends BaseProps {
  src?: string | VargElement<"speech">;
  srt?: string;
  style?: "tiktok" | "karaoke" | "bounce" | "typewriter";
  position?: "top" | "center" | "bottom";
  color?: string;
  activeColor?: string;
  fontSize?: number;
  /** Number of words to display per subtitle line. When set with activeColor, enables karaoke-style highlighting where the active word is colored differently. */
  wordsPerLine?: number;
  /** When src is a Speech element, include its audio track in the video. Defaults to false. */
  withAudio?: boolean;
  /** Font to use for captions. Overrides the style preset's default font.
   *  Available: "montserrat" | "roboto" | "poppins" | "inter" | "bebas-neue" | "rock-salt" | "oswald" | "space-grotesk" | "dm-sans" */
  font?: string;
}

export interface SplitProps extends BaseProps {
  direction?: "horizontal" | "vertical";
  children?: VargNode;
}

export interface SliderProps extends BaseProps {
  direction?: "horizontal" | "vertical";
  children?: VargNode;
}

export interface SwipeProps extends BaseProps {
  direction?: "left" | "right" | "up" | "down";
  interval?: number;
  children?: VargNode;
}

export interface PackshotProps extends BaseProps {
  /**
   * Packshot background.
   *
   * - `string` — treated as a solid fill color (e.g. `"#000000"`).
   * - `VargElement<"image">` — a generated or static image, rendered and
   *   used as a full-bleed cover background.
   * - `VargElement<"video">` — a generated or static video, rendered and
   *   used as a looping full-bleed cover background.
   */
  background?: VargElement<"image"> | VargElement<"video"> | string;
  /**
   * Logo image.
   *
   * - `string` — a URL or local file path pointing to an existing image.
   * - `VargElement<"image">` — a generated image (e.g. `Image({ prompt, model })`),
   *   which will be rendered via the AI pipeline and used as an overlay.
   */
  logo?: VargElement<"image"> | string;
  /**
   * Logo position on screen.
   *
   * Accepts any {@link Position} value including PositionObject (`{ x, y }`).
   * A PositionObject is normalised to the closest string position at render
   * time (see ctaPosition docs for the conversion rules).
   */
  logoPosition?: Position;
  logoSize?: SizeValue;
  /** Title text displayed below the logo (e.g. app name) */
  title?: string;
  /** Title text color (hex, default: "#FFFFFF") */
  titleColor?: string;
  /** Title position on screen (default: "center") */
  titlePosition?: Position;
  /** CTA button text */
  cta?: string;
  /**
   * CTA button position on screen.
   *
   * Accepts any value from the {@link Position} union:
   * - **String literals** (`"top"`, `"bottom"`, `"center"`, `"top-left"`, etc.)
   *   are used directly (compound positions like `"top-left"` are collapsed to
   *   their vertical component for the blinking-button renderer).
   * - **PositionObject** (`{ x, y }` with optional `originX` / `originY`) is
   *   supported and will be **normalised** to the closest string position at
   *   render time.  The y-coordinate is converted to a 0-1 fraction (pixels
   *   are divided by the video height; percentages are divided by 100) and
   *   mapped to `"top"` (< 33 %), `"center"` (33-67 %), or `"bottom"` (> 67 %).
   *   The x-coordinate follows the same logic for contexts that use the full
   *   nine-position grid.
   */
  ctaPosition?: Position;
  /** CTA button background color (hex, default: "#FF6B00") */
  ctaColor?: string;
  /** CTA button text color (hex, default: "#FFFFFF") */
  ctaTextColor?: string;
  /** CTA button size in pixels { width, height } */
  ctaSize?: { width: number; height: number };
  /** Enable blinking animation (scale + brightness pulse) */
  blinkCta?: boolean;
  /** Blink animation cycle duration in seconds (default: 0.8) */
  blinkFrequency?: number;
  /** Packshot duration in seconds */
  duration?: number;
}

export type RenderMode = "strict" | "preview";

export interface DefaultModels {
  image?: ImageModelV3;
  video?: VideoModelV3;
  speech?: SpeechModelV3;
  music?: MusicModelV3;
  transcription?: TranscriptionModelV3;
}

/** Pricing metadata for a single generation call, emitted via onGeneration. */
export interface GenerationPricingEntry {
  /** Generation type */
  type: "image" | "video" | "speech" | "music" | "transcription";
  /** Model ID used */
  model: string;
  /** Estimated cost in credits (before generation) */
  estimated?: number;
  /** Actual cost in credits (after generation) */
  actual?: number;
  /** Billing mode */
  billing?: "metered" | "byok" | "x402";
  /** Whether result was served from cache */
  cached?: boolean;
  /** Gateway job ID for this generation */
  jobId?: string;
}

export interface RenderOptions {
  output?: string;
  cache?: string | CacheStorage;
  quiet?: boolean;
  verbose?: boolean;
  mode?: RenderMode;
  defaults?: DefaultModels;
  backend?: FFmpegBackend;
  storage?: StorageProvider;
  /** Max concurrent clip renders. Defaults to 3. */
  concurrency?: number;
  /** Callback invoked after each AI generation completes. Used to accumulate per-model costs. */
  onGeneration?: (entry: GenerationPricingEntry) => void;
}

// Re-export from file module for convenience
export type { FileMetadata, GeneratedFileType } from "../ai-sdk/file";

export interface RenderResult {
  /** Final rendered video buffer */
  video: Uint8Array;
  /** All intermediate files generated during rendering (lazy-loaded) */
  files: File[];
}

// ── FFmpeg processing element props ──────────────────────────────────

/** Minimal gateway interface for FFmpeg utility methods. Implemented by VargProvider. */
export interface FFmpegGateway {
  slice(params: {
    video_url: string;
    codec?: "copy" | "reencode";
    every?: number;
    at?: number[];
    count?: number;
    ranges?: Array<{ start: number; end: number }>;
  }): Promise<{
    url: string;
    segments: Array<{ url: string; index: number; filename: string }>;
    jobId: string;
  }>;
  probe(params: { url: string }): Promise<{
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
    audio_codec?: string;
    format?: string;
    bitrate?: number;
    fps?: number;
    size_bytes?: number;
  }>;
  ffmpeg(params: {
    command: string;
    input_files?: Record<string, string>;
    output_files?: Record<string, string> | string;
  }): Promise<{
    url: string;
    mediaType: string;
    jobId: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface SliceProps {
  /** Source video: URL string, File object, or ResolvedElement */
  src: string | File | VargElement;
  /** Codec mode: "copy" for keyframe-aligned fast cuts, "reencode" for frame-accurate */
  codec?: "copy" | "reencode";
  /** Split every N seconds */
  every?: number;
  /** Split at specific timestamps (cut points) */
  at?: number[];
  /** Split into N equal parts (probes duration automatically) */
  count?: number;
  /** Split at explicit time ranges */
  ranges?: Array<{ start: number; end: number }>;
  /** Authenticated gateway provider (e.g., varg). Required for cloud rendering. */
  gateway?: FFmpegGateway;
}

export interface FFmpegProps {
  /** Source input: URL string, File object, or ResolvedElement (used as {{in_1}}) */
  src?: string | File | VargElement;
  /** Multiple named inputs (for multi-input commands) */
  inputs?: Record<string, string | File | VargElement>;
  /** FFmpeg command flags (without -i input, which is added automatically for src) */
  command: string;
  /** Authenticated gateway provider (e.g., varg). Required for cloud rendering. */
  gateway?: FFmpegGateway;
}

export interface ProbeProps {
  /** Source to probe: URL string, File object, or ResolvedElement */
  src: string | File | VargElement;
  /** Authenticated gateway provider (e.g., varg). Required for cloud rendering. */
  gateway?: FFmpegGateway;
}

/**
 * A video segment from `await Slice(...)`. Each segment is a `ResolvedElement<"video">`
 * with its CDN URL, index, and position within the source video.
 *
 * @example
 * ```tsx
 * const sliced = await Slice({ src: video, every: 10 });
 * sliced.segments[0].url       // CDN URL
 * sliced.segments[0].index     // 0
 * sliced.segments[0].start     // 0 (seconds in source)
 * sliced.segments[0].end       // 10 (seconds in source)
 * sliced.segments[0].duration  // 10 (from ResolvedElement)
 * sliced.segments[0].file      // File (from ResolvedElement)
 * ```
 */
export type SliceSegment =
  import("./resolved-element").ResolvedElement<"video"> & {
    readonly url: string;
    readonly index: number;
    readonly start: number;
    readonly end: number;
  };

export interface ElementPropsMap {
  render: RenderProps;
  clip: ClipProps;
  overlay: OverlayProps;
  image: ImageProps;
  video: VideoProps;
  speech: SpeechProps;
  "talking-head": TalkingHeadProps;
  title: TitleProps;
  subtitle: SubtitleProps;
  music: MusicProps;
  captions: CaptionsProps;
  split: SplitProps;
  slider: SliderProps;
  swipe: SwipeProps;
  packshot: PackshotProps;
  slice: SliceProps;
  ffmpeg: FFmpegProps;
  probe: ProbeProps;
}
