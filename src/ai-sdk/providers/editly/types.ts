// Types from original editly (https://github.com/mifi/editly)
// Adapted for pure ffmpeg implementation (no fabric/canvas/gl dependencies)

import type { FFmpegBackend } from "./backends";

export type OriginX = "left" | "center" | "right";
export type OriginY = "top" | "center" | "bottom";
export type SizeValue = number | `${number}%` | `${number}px`;

/**
 * How to fit image to screen. Can be one of:
 * - `'contain'` - All the video will be contained within the frame and letterboxed.
 * - `'contain-blur'` - Like contain, but with a blurred copy as the letterbox.
 * - `'cover'` - Video be cropped to cover the whole screen (aspect ratio preserved).
 * - `'stretch'` - Video will be stretched to cover the whole screen (aspect ratio ignored).
 *
 * @default 'contain-blur'
 */
export type ResizeMode = "contain" | "contain-blur" | "cover" | "stretch";

export interface PositionObject {
  x: SizeValue;
  y: SizeValue;
  originX?: OriginX;
  originY?: OriginY;
}

/**
 * Certain layers support the position parameter.
 */
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

/**
 * Arbitrary audio tracks.
 */
export interface AudioTrack {
  path: string;
  mixVolume?: number | string;
  cutFrom?: number;
  cutTo?: number;
  start?: number;
}

/**
 * Ken Burns parameters.
 */
export interface KenBurns {
  zoomDirection?: "in" | "out" | "left" | "right" | null;
  zoomAmount?: number;
}

export type LayerType =
  | "video"
  | "audio"
  | "detached-audio"
  | "image"
  | "image-overlay"
  | "title"
  | "subtitle"
  | "title-background"
  | "news-title"
  | "slide-in-text"
  | "fill-color"
  | "pause"
  | "radial-gradient"
  | "linear-gradient"
  | "rainbow-colors";

export interface BaseLayer {
  type: LayerType;
  start?: number;
  stop?: number;
}

export interface TextLayer extends BaseLayer {
  text: string;
  textColor?: string;
  fontPath?: string;
  fontFamily?: string;
}

/**
 * Crop position anchor for cover mode.
 * NOTE: This is a varg extension to editly, not in the original.
 */
export type CropPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * For video layers, if parent `clip.duration` is specified, the video will be slowed/sped-up to match `clip.duration`.
 * If `cutFrom`/`cutTo` is set, the resulting segment (`cutTo`-`cutFrom`) will be slowed/sped-up to fit `clip.duration`.
 */
export interface VideoLayer extends BaseLayer {
  type: "video";
  path: string;
  resizeMode?: ResizeMode;
  cropPosition?: CropPosition;
  cutFrom?: number;
  cutTo?: number;
  width?: SizeValue;
  height?: SizeValue;
  left?: SizeValue;
  top?: SizeValue;
  originX?: OriginX;
  originY?: OriginY;
  mixVolume?: number | string;
}

/**
 * Audio layers will be mixed together.
 */
export interface AudioLayer extends BaseLayer {
  type: "audio";
  path: string;
  cutFrom?: number;
  cutTo?: number;
  mixVolume?: number | string;
}

/**
 * Detached audio - like audioTracks but start time is relative to clip's start.
 */
export interface DetachedAudioLayer extends BaseLayer, AudioTrack {
  type: "detached-audio";
}

/**
 * Full screen image.
 */
export interface ImageLayer extends BaseLayer, KenBurns {
  type: "image";
  path: string;
  resizeMode?: ResizeMode;
  duration?: number;
}

/**
 * Image overlay with a custom position and size on the screen.
 */
export interface ImageOverlayLayer extends BaseLayer, KenBurns {
  type: "image-overlay";
  path: string;
  position?: Position;
  width?: SizeValue;
  height?: SizeValue;
  resizeMode?: ResizeMode;
  cropPosition?: CropPosition;
}

export interface TitleLayer extends TextLayer, KenBurns {
  type: "title";
  position?: Position;
}

export interface SubtitleLayer extends TextLayer {
  type: "subtitle";
  backgroundColor?: string;
}

/**
 * Title with background.
 */
export interface TitleBackgroundLayer extends TextLayer {
  type: "title-background";
  background?: BackgroundLayer;
}

export interface NewsTitleLayer extends TextLayer {
  type: "news-title";
  backgroundColor?: string;
  position?: Position;
}

export interface SlideInTextLayer extends TextLayer {
  type: "slide-in-text";
  fontSize?: number;
  charSpacing?: number;
  color?: string;
  position?: Position;
}

export interface FillColorLayer extends BaseLayer {
  type: "fill-color";
  color?: string;
}

export interface PauseLayer extends BaseLayer {
  type: "pause";
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

export type Layer =
  | VideoLayer
  | AudioLayer
  | DetachedAudioLayer
  | ImageLayer
  | ImageOverlayLayer
  | TitleLayer
  | SubtitleLayer
  | TitleBackgroundLayer
  | NewsTitleLayer
  | SlideInTextLayer
  | FillColorLayer
  | PauseLayer
  | RadialGradientLayer
  | LinearGradientLayer
  | RainbowColorsLayer;

/**
 * Special layers that can be used in the 'title-background' layer.
 */
export type BackgroundLayer =
  | RadialGradientLayer
  | LinearGradientLayer
  | FillColorLayer;

/**
 * Curve types for audio fades.
 * @see https://trac.ffmpeg.org/wiki/AfadeCurves
 */
export type CurveType =
  | "tri"
  | "qsin"
  | "hsin"
  | "esin"
  | "log"
  | "ipar"
  | "qua"
  | "cub"
  | "squ"
  | "cbr"
  | "par"
  | "exp"
  | "iqsin"
  | "ihsin"
  | "dese"
  | "desi"
  | "losi"
  | "nofade";

export interface TransitionOptions {
  duration?: number;
  name?: string;
  audioOutCurve?: CurveType;
  audioInCurve?: CurveType;
}

export interface Clip {
  layers: Layer[];
  duration?: number;
  transition?: TransitionOptions | null;
}

export interface DefaultLayerOptions {
  fontPath?: string;
  [key: string]: unknown;
}

export type DefaultLayerTypeOptions = {
  [P in LayerType]?: Partial<Omit<Extract<Layer, { type: P }>, "type">>;
};

export interface DefaultOptions {
  duration?: number;
  layer?: DefaultLayerOptions;
  layerType?: DefaultLayerTypeOptions;
  transition?: TransitionOptions | null;
}

/**
 * Audio normalization options.
 * @see https://ffmpeg.org/ffmpeg-filters.html#dynaudnorm
 */
export interface AudioNormalizationOptions {
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
  customOutputArgs?: string[];
  allowRemoteRequests?: boolean;
  fast?: boolean;
  defaults?: DefaultOptions;
  audioTracks?: AudioTrack[];
  audioFilePath?: string;
  backgroundAudioVolume?: string | number;
  loopAudio?: boolean;
  keepSourceAudio?: boolean;
  clipsAudioVolume?: number | string;
  outputVolume?: number | string;
  audioNorm?: AudioNormalizationOptions;
  verbose?: boolean;
  enableFfmpegLog?: boolean;
  /** End output when shortest stream ends (video or audio) */
  shortest?: boolean;
  /** FFmpeg backend for execution (defaults to local ffmpeg) */
  backend?: FFmpegBackend;
}

export type EditlyOutput =
  | { type: "file"; path: string }
  | { type: "url"; url: string };

export interface EditlyResult {
  output: EditlyOutput;
}

// Internal types used by our implementation
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
