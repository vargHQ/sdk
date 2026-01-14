export type ResizeMode = "contain" | "contain-blur" | "cover" | "stretch";

export type Position =
  | "top"
  | "top-left"
  | "top-right"
  | "center"
  | "center-left"
  | "center-right"
  | "bottom"
  | "bottom-left"
  | "bottom-right"
  | PositionObject;

export interface PositionObject {
  x: number;
  y: number;
  originX?: "left" | "center" | "right";
  originY?: "top" | "center" | "bottom";
}

export interface BaseLayer {
  type: string;
  start?: number;
  stop?: number;
}

export interface VideoLayer extends BaseLayer {
  type: "video";
  path: string;
  resizeMode?: ResizeMode;
  cutFrom?: number;
  cutTo?: number;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  mixVolume?: number | string;
}

export interface AudioLayer extends BaseLayer {
  type: "audio";
  path: string;
  cutFrom?: number;
  cutTo?: number;
  mixVolume?: number | string;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  path: string;
  resizeMode?: ResizeMode;
  zoomDirection?: "in" | "out" | "left" | "right" | null;
  zoomAmount?: number;
}

export interface ImageOverlayLayer extends BaseLayer {
  type: "image-overlay";
  path: string;
  position?: Position;
  width?: number;
  height?: number;
}

export interface TitleLayer extends BaseLayer {
  type: "title";
  text: string;
  textColor?: string;
  fontPath?: string;
  position?: Position;
  zoomDirection?: "in" | "out" | null;
  zoomAmount?: number;
}

export interface SubtitleLayer extends BaseLayer {
  type: "subtitle";
  text: string;
  textColor?: string;
  backgroundColor?: string;
}

export interface FillColorLayer extends BaseLayer {
  type: "fill-color";
  color?: string;
}

export interface RadialGradientLayer extends BaseLayer {
  type: "radial-gradient";
  colors?: [string, string];
}

export interface LinearGradientLayer extends BaseLayer {
  type: "linear-gradient";
  colors?: [string, string];
}

export interface RainbowColorsLayer extends BaseLayer {
  type: "rainbow-colors";
}

export interface TitleBackgroundLayer extends BaseLayer {
  type: "title-background";
  text: string;
  textColor?: string;
  background?: FillColorLayer | RadialGradientLayer | LinearGradientLayer;
}

export interface PauseLayer extends BaseLayer {
  type: "pause";
  color?: string;
}

export type Layer =
  | VideoLayer
  | AudioLayer
  | ImageLayer
  | ImageOverlayLayer
  | TitleLayer
  | SubtitleLayer
  | FillColorLayer
  | RadialGradientLayer
  | LinearGradientLayer
  | RainbowColorsLayer
  | TitleBackgroundLayer
  | PauseLayer;

export interface TransitionOptions {
  name?: string;
  duration?: number;
}

export interface AudioTrack {
  path: string;
  mixVolume?: number | string;
  cutFrom?: number;
  cutTo?: number;
  start?: number;
}

export interface Clip {
  layers: Layer[];
  duration?: number;
  transition?: TransitionOptions | null;
}

export interface DefaultOptions {
  duration?: number;
  transition?: TransitionOptions | null;
  layer?: Record<string, unknown>;
}

export interface AudioNormOptions {
  enable?: boolean;
  gaussSize?: number;
  maxGain?: number;
}

export interface EditlyConfig {
  outPath: string;
  clips: Clip[];
  width?: number;
  height?: number;
  fps?: number;
  fast?: boolean;
  defaults?: DefaultOptions;
  audioFilePath?: string;
  loopAudio?: boolean;
  keepSourceAudio?: boolean;
  clipsAudioVolume?: number | string;
  outputVolume?: number | string;
  audioTracks?: AudioTrack[];
  audioNorm?: AudioNormOptions;
  allowRemoteRequests?: boolean;
  customOutputArgs?: string[];
  verbose?: boolean;
  enableFfmpegLog?: boolean;
}

export interface VideoInfo {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  framerateStr?: string;
  rotation?: number;
}

export interface ProcessedClip {
  layers: Layer[];
  duration: number;
  transition: Required<TransitionOptions>;
}
