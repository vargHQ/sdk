// packages/sdk/src/types.ts

// ============================================
// MODEL SPECIFICATION
// ============================================

export type ModelType = 'video' | 'image' | 'audio';

export interface ImageModelV1 {
  readonly specificationVersion: 'v1';
  readonly provider: string;
  readonly modelId: string;
  readonly type: 'image';

  doGenerate(params: ImageModelParams): Promise<ImageModelResult>;
}

export interface VideoModelV1 {
  readonly specificationVersion: 'v1';
  readonly provider: string;
  readonly modelId: string;
  readonly type: 'video';

  doGenerate(params: VideoModelParams): Promise<VideoModelResult>;
}

export interface AudioModelV1 {
  readonly specificationVersion: 'v1';
  readonly provider: string;
  readonly modelId: string;
  readonly type: 'audio';

  doGenerate(params: AudioModelParams): Promise<AudioModelResult>;
}

// ============================================
// MODEL PARAMS (internal, passed to doGenerate)
// ============================================

export interface ImageModelParams {
  prompt: string;
  n: number;
  size?: string;
  aspectRatio?: string;
  seed?: number;
  providerOptions: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

export interface VideoModelParams {
  prompt?: string;
  image?: string;
  video?: string;
  duration?: number;
  aspectRatio?: string;
  seed?: number;
  providerOptions: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

export interface AudioModelParams {
  prompt?: string;
  text?: string;
  voice?: string;
  video?: string;
  duration?: number;
  seed?: number;
  providerOptions: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

// ============================================
// MODEL RESULTS (internal, returned from doGenerate)
// ============================================

export interface ImageModelResult {
  images: GeneratedFile[];
  warnings?: string[];
  response?: {
    timestamp: Date;
    modelId: string;
  };
}

export interface VideoModelResult {
  videos: GeneratedFile[];
  warnings?: string[];
  response?: {
    timestamp: Date;
    modelId: string;
  };
}

export interface AudioModelResult {
  audios: GeneratedFile[];
  warnings?: string[];
  response?: {
    timestamp: Date;
    modelId: string;
  };
}

// ============================================
// GENERATED FILE
// ============================================

export interface GeneratedFile {
  base64?: string;
  url?: string;
  uint8Array?: Uint8Array;
  mediaType: string;
}

// ============================================
// PUBLIC API PARAMS
// ============================================

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';

export type ImageAsset =
  | string
  | Buffer
  | Uint8Array
  | { base64: string }
  | { url: string }
  | GeneratedImage;

export type VideoAsset =
  | string
  | Buffer
  | Uint8Array
  | { base64: string }
  | { url: string }
  | GeneratedVideo;

// ============================================
// PUBLIC API RESULTS
// ============================================

export interface GeneratedImage {
  readonly base64: string;
  readonly uint8Array: Uint8Array;
  readonly mediaType: string;
}

export interface GeneratedVideo {
  readonly base64: string;
  readonly uint8Array: Uint8Array;
  readonly mediaType: string;
}

export interface GeneratedAudio {
  readonly base64: string;
  readonly uint8Array: Uint8Array;
  readonly mediaType: string;
}

export interface GenerateImageResult {
  readonly images: GeneratedImage[];
  readonly image: GeneratedImage;
  readonly warnings?: string[];
  readonly response?: {
    timestamp: Date;
    modelId: string;
  };
}

export interface GenerateVideoResult {
  readonly videos: GeneratedVideo[];
  readonly video: GeneratedVideo;
  readonly warnings?: string[];
  readonly response?: {
    timestamp: Date;
    modelId: string;
  };
}

export interface GenerateAudioResult {
  readonly audios: GeneratedAudio[];
  readonly audio: GeneratedAudio;
  readonly warnings?: string[];
  readonly response?: {
    timestamp: Date;
    modelId: string;
  };
}
