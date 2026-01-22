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
  | "animate"
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
      video?:
        | Uint8Array
        | string
        | VargElement<"animate">
        | VargElement<"video">;
    };

export type VideoProps = BaseProps &
  PositionProps &
  AudioProps &
  TrimProps & {
    prompt?: VideoPrompt;
    src?: string;
    model?: VideoModelV3;
    resize?: ResizeMode;
  };

// Image-to-video animation
export interface AnimateProps extends BaseProps, PositionProps {
  image?: VargElement<"image">;
  src?: string;
  model?: VideoModelV3;
  motion?: string;
  duration?: number;
}

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
    /** End output when video ends, trimming longer audio */
    shortest?: boolean;
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

export type RenderMode = "strict" | "default" | "preview";

export interface RenderOptions {
  output?: string;
  cache?: string;
  quiet?: boolean;
  mode?: RenderMode;
}

export interface ElementPropsMap {
  render: RenderProps;
  clip: ClipProps;
  overlay: OverlayProps;
  image: ImageProps;
  video: VideoProps;
  animate: AnimateProps;
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
