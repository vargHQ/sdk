import type { ImageModelV3, SpeechModelV3 } from "@ai-sdk/provider";
import type { MusicModelV3 } from "../ai-sdk/music-model";
import type {
  Position,
  ResizeMode,
  SizeValue,
  TransitionOptions,
} from "../ai-sdk/providers/editly/types";
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
  | "slot"
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
    aspectRatio?: `${number}:${number}`;
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
    loop?: boolean;
    ducking?: boolean;
  };

export interface CaptionsProps extends BaseProps {
  src?: string | VargElement<"speech">;
  srt?: string;
  style?: "tiktok" | "karaoke" | "bounce" | "typewriter";
  color?: string;
  activeColor?: string;
  fontSize?: number;
}

export interface SplitProps extends BaseProps {
  direction?: "horizontal" | "vertical";
  children?: VargNode;
}

/** Position anchor for fit-cover cropping */
export type SlotPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Fit mode for video in slot */
export type SlotFit = "cover" | "contain" | "fill" | "none";

export interface SlotProps extends BaseProps {
  /** Tailwind-style class string: "fit-cover pos-center bg-blur-24" */
  class?: string;
  /** Fit mode (or use class="fit-cover") */
  fit?: SlotFit;
  /** Position anchor (or use class="pos-center") */
  position?: SlotPosition;
  /** Blur intensity 0-100 for contain mode background (or use class="bg-blur-24") */
  bgBlur?: number;
  /** Dim intensity 0-100 for contain mode background (or use class="bg-dim-25") */
  bgDim?: number;
  /** Scale 100-200 for blurred background zoom (or use class="bg-scale-115") */
  bgScale?: number;
  /** Solid color fallback for contain mode (or use class="bg-color-000000") */
  bgColor?: string;
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
  logoPosition?: Position;
  logoSize?: SizeValue;
  cta?: string;
  ctaPosition?: Position;
  ctaColor?: string;
  ctaSize?: number;
  blinkCta?: boolean;
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
  cache?: string;
  quiet?: boolean;
  verbose?: boolean;
  mode?: RenderMode;
  defaults?: DefaultModels;
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
