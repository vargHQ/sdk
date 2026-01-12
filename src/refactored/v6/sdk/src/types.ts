// packages/sdk/src/types.ts

export type ModelType = 'video' | 'image' | 'audio';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';

// ============================================
// ASSETS
// ============================================

export type ImageAsset =
  | string
  | Buffer
  | Uint8Array
  | { base64: string }
  | { url: string }
  | GeneratedFile;

export type VideoAsset =
  | string
  | Buffer
  | Uint8Array
  | { base64: string }
  | { url: string }
  | GeneratedFile;

export type AudioAsset =
  | string
  | Buffer
  | Uint8Array
  | { base64: string }
  | { url: string }
  | GeneratedFile;

// ============================================
// GENERATED FILE
// ============================================

export interface GeneratedFile {
  url?: string;
  base64?: string;
  uint8Array?: Uint8Array;
  mediaType: string;
  toDataURL(): string;
  toBuffer(): Promise<Buffer>;
  save(path: string): Promise<void>;
}

// ============================================
// RESULTS
// ============================================

export interface GenerateResult {
  files: GeneratedFile[];
  raw: unknown;
  warnings?: string[];
}

export interface ImageGenerateResult extends GenerateResult {
  images: GeneratedFile[];
  image: GeneratedFile;
}

export interface VideoGenerateResult extends GenerateResult {
  videos: GeneratedFile[];
  video: GeneratedFile;
}

export interface AudioGenerateResult extends GenerateResult {
  audios: GeneratedFile[];
  audio: GeneratedFile;
}

// ============================================
// BASE PARAMS
// ============================================

export interface BaseGenerateParams {
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
  aspectRatio?: AspectRatio;
  duration?: number;
  n?: number;
  size?: `${number}x${number}`;
  strength?: number;
  image?: { url?: string; base64?: string };
  video?: { url?: string; base64?: string };
  providerOptions?: Record<string, unknown>;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

// ============================================
// IMAGE PARAMS
// ============================================

export interface GenerateImageParams extends BaseGenerateParams {
  model: ImageModel;
  prompt: string;
}

export interface TransformImageParams extends BaseGenerateParams {
  model: ImageModel;
  image: ImageAsset;
}

export interface UpscaleImageParams extends BaseGenerateParams {
  model: ImageModel;
  image: ImageAsset;
  scale?: 2 | 4;
}

// ============================================
// VIDEO PARAMS
// ============================================

export interface GenerateVideoParams extends BaseGenerateParams {
  model: VideoModel;
  prompt: string;
}

export interface AnimateImageParams extends BaseGenerateParams {
  model: VideoModel;
  image: ImageAsset;
}

export interface TransformVideoParams extends BaseGenerateParams {
  model: VideoModel;
  video: VideoAsset;
}

// ============================================
// AUDIO PARAMS
// ============================================

export interface GenerateMusicParams extends BaseGenerateParams {
  model: AudioModel;
  prompt: string;
}

export interface GenerateSpeechParams extends BaseGenerateParams {
  model: AudioModel;
  text: string;
  voice?: string;
}

export interface GenerateSoundParams extends BaseGenerateParams {
  model: AudioModel;
  prompt: string;
}

// ============================================
// MODELS
// ============================================

export interface BaseModel {
  readonly provider: string;
  readonly modelId: string;
  readonly path: string;
  readonly type: ModelType;
  doGenerate(params: BaseGenerateParams): Promise<GenerateResult>;
}

export interface ImageModel extends BaseModel {
  readonly type: 'image';
}

export interface VideoModel extends BaseModel {
  readonly type: 'video';
}

export interface AudioModel extends BaseModel {
  readonly type: 'audio';
}

export type Model = ImageModel | VideoModel | AudioModel;
