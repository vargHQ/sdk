import type { ImageModelV3, SpeechModelV3 } from "@ai-sdk/provider";
import type {
  Position,
  ResizeMode,
  TransitionOptions,
} from "../providers/editly/types";
import type { VideoModelV3 } from "../video-model";

export type VargElementType =
  | "render"
  | "clip"
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
  children?: VargNode;
}

export interface ImageProps extends BaseProps {
  prompt?: string;
  src?: string;
  model?: ImageModelV3;
  aspectRatio?: `${number}:${number}`;
  zoom?: "in" | "out" | "left" | "right";
  resize?: ResizeMode;
  position?: Position;
  size?: { width: string; height: string };
  removeBackground?: boolean;
}

// Video layer - t2v generation or existing file
export interface VideoProps extends BaseProps {
  prompt?: string;
  src?: string;
  model?: VideoModelV3;
  resize?: ResizeMode;
  cutFrom?: number;
  cutTo?: number;
  volume?: number;
  keepAudio?: boolean;
}

// Image-to-video animation
export interface AnimateProps extends BaseProps {
  /** Accepts <Image /> element. JSX returns VargElement so we accept both for ergonomics. */
  image?: VargElement<"image"> | VargElement;
  src?: string;
  model?: VideoModelV3;
  motion?: string;
  duration?: number;
}

export interface SpeechProps extends BaseProps {
  voice?: string;
  model?: SpeechModelV3;
  id?: string;
  volume?: number;
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

export interface MusicProps extends BaseProps {
  prompt?: string;
  src?: string;
  loop?: boolean;
  ducking?: boolean;
  volume?: number;
}

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
  background?: VargElement<"image">;
  logo?: string;
  cta?: string;
  ctaColor?: string;
  blinkCta?: boolean;
}

export interface RenderOptions {
  output?: string;
  cache?: string;
}

export interface ElementPropsMap {
  render: RenderProps;
  clip: ClipProps;
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
