// packages/sdk/src/types.ts

// ============================================
// COMMON PARAMS
// ============================================

export interface BaseGenerateParams {
    prompt?: string;
    negativePrompt?: string;
    seed?: number;
    aspectRatio?: AspectRatio;
    
    // Provider-specific options passthrough
    providerOptions?: Record<string, unknown>;
    
    // Control
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
  }
  
  export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';
  
  
  // ============================================
  // PER-MODALITY PARAMS
  // ============================================
  
  export interface ImageGenerateParams extends BaseGenerateParams {
    prompt: string;
    n?: number;
    size?: `${number}x${number}`;
  }
  
  export interface VideoGenerateParams extends BaseGenerateParams {
    prompt: string;
    duration?: number;  // seconds
    fps?: number;
  }
  
  export interface AnimateImageParams extends BaseGenerateParams {
    image: ImageAsset;
    prompt?: string;
    duration?: number;
  }
  
  export interface TransformVideoParams extends BaseGenerateParams {
    video: VideoAsset;
    prompt?: string;
  }
  
  export interface AudioGenerateParams extends BaseGenerateParams {
    prompt: string;
    duration?: number;
  }
  
  export interface SpeechGenerateParams extends BaseGenerateParams {
    text: string;
    voice?: string;
  }
  
  
  // ============================================
  // ASSETS (inputs)
  // ============================================
  
  export type ImageAsset = 
    | string                      // URL
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
  
  
  // ============================================
  // RESULTS
  // ============================================
  
  export interface GeneratedFile {
    url?: string;
    base64?: string;
    uint8Array?: Uint8Array;
    mediaType: string;
    
    // Convenience methods
    toDataURL(): string;
    toBuffer(): Promise<Buffer>;
    save(path: string): Promise<void>;
  }
  
  export interface GenerateResult {
    files: GeneratedFile[];
    raw: unknown;  // original provider response
    warnings?: string[];
  }
  
  export interface ImageGenerateResult extends GenerateResult {
    images: GeneratedFile[];
    image: GeneratedFile;  // first
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
  // MODEL
  // ============================================
  
  export interface Model {
    provider: string;
    version: string;
    modelId: string;
    path: string;
    type: 'video' | 'image' | 'audio';
    
    doGenerate(params: BaseGenerateParams): Promise<GenerateResult>;
  }