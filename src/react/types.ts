import type {
  ImageModelV3,
  SharedV3ProviderOptions,
  SpeechModelV3,
} from "@ai-sdk/provider";
import type { FFmpegBackend } from "@/ai-sdk/providers/editly/backends";
import type { CacheStorage } from "../ai-sdk/cache";
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
  | "packshot";

export interface VargElement<T extends VargElementType = VargElementType> {
  type: T;
  props: Record<string, unknown>;
  children: VargNode[];
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
  children?: VargNode;
}

export type ImageInput = Uint8Array | string | VargElement<"image">;
export type ImagePrompt = string | { text?: string; images: ImageInput[] };

export interface ImageProps extends BaseProps, PositionProps {
  prompt?: ImagePrompt;
  src?: string;
  model?: ImageModelV3;
  aspectRatio?: `${number}:${number}`;
  zoom?: "in" | "out" | "left" | "right";
  resize?: ResizeMode;
  position?: Position;
  size?: { width: string; height: string };
  removeBackground?: boolean;
  /** Seed for reproducible generation */
  seed?: number;
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
    /** Seed for reproducible generation */
    seed?: number;
    /** Provider-specific options (e.g., fal: { generate_audio: true }) */
    providerOptions?: SharedV3ProviderOptions;
  };

export interface SpeechProps extends BaseProps, VolumeProps {
  voice?: string;
  model?: SpeechModelV3;
  id?: string;
  children?: string;
}

export interface TalkingHeadProps extends BaseProps {
  character?: string;
  src?: string;
  voice?: string;
  model?: VideoModelV3;
  lipsyncModel?: VideoModelV3;
  position?:
    | Position
    | { left?: string; right?: string; top?: string; bottom?: string };
  size?: { width: string; height: string };
  children?: string;
}

export interface TitleProps extends BaseProps {
  position?: Position;
  color?: string;
  start?: number;
  end?: number;
  children?: string;
}

export interface SubtitleProps extends BaseProps {
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
    /** Seed for reproducible generation */
    seed?: number;
    /** Provider-specific options */
    providerOptions?: SharedV3ProviderOptions;
  };

export interface CaptionsProps extends BaseProps {
  src?: string | VargElement<"speech">;
  srt?: string;
  style?: "tiktok" | "karaoke" | "bounce" | "typewriter";
  position?: "top" | "center" | "bottom";
  color?: string;
  activeColor?: string;
  fontSize?: number;
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
  background?: VargElement<"image"> | string;
  logo?: string;
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
}

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
}
