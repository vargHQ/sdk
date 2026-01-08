/**
 * Core types for varg SDK v2
 * AI-SDK style polymorphic model interfaces
 */

// ============================================================================
// Media Result - unified result with lazy loading helpers
// ============================================================================

export class MediaResult {
  readonly url: string;
  readonly mimeType: string;
  private _buffer?: ArrayBuffer;

  constructor(url: string, mimeType: string) {
    this.url = url;
    this.mimeType = mimeType;
  }

  async buffer(): Promise<ArrayBuffer> {
    if (this._buffer) return this._buffer;

    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }
    this._buffer = await response.arrayBuffer();
    return this._buffer;
  }

  async save(path: string): Promise<void> {
    const buffer = await this.buffer();
    await Bun.write(path, buffer);
  }

  async base64(): Promise<string> {
    const buffer = await this.buffer();
    return Buffer.from(buffer).toString("base64");
  }

  async dataUrl(): Promise<string> {
    const b64 = await this.base64();
    return `data:${this.mimeType};base64,${b64}`;
  }
}

// ============================================================================
// Base Model Interface
// ============================================================================

export interface Model {
  readonly specificationVersion: "v1";
  readonly provider: string;
  readonly modelId: string;
}

// ============================================================================
// Video Model
// ============================================================================

export interface VideoModel extends Model {
  readonly type: "video";

  doGenerate(options: VideoGenerateOptions): Promise<VideoGenerateResult>;
}

export interface VideoGenerateOptions {
  prompt: string;
  image?: string | ArrayBuffer;
  duration?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface VideoGenerateResult {
  video: MediaResult;
  duration?: number;
  warnings?: string[];
}

// ============================================================================
// Image Model
// ============================================================================

export interface ImageModel extends Model {
  readonly type: "image";

  doGenerate(options: ImageGenerateOptions): Promise<ImageGenerateResult>;
}

export type ImagePrompt =
  | string
  | {
      text: string;
      images?: (string | ArrayBuffer)[];
    };

export interface ImageGenerateOptions {
  prompt: ImagePrompt;
  size?: string;
  n?: number;
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface ImageGenerateResult {
  images: MediaResult[];
  warnings?: string[];
}

// ============================================================================
// TTS Model (Text-to-Speech)
// ============================================================================

export interface TTSModel extends Model {
  readonly type: "tts";

  doGenerate(options: TTSGenerateOptions): Promise<TTSGenerateResult>;
}

export interface TTSGenerateOptions {
  text: string;
  voice?: string;
  speed?: number;
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface TTSGenerateResult {
  audio: MediaResult;
  duration?: number;
  warnings?: string[];
}

// ============================================================================
// Transcription Model
// ============================================================================

export interface TranscriptionModel extends Model {
  readonly type: "transcription";

  doTranscribe(options: TranscribeOptions): Promise<TranscribeResult>;
}

export interface TranscribeOptions {
  audio: string | ArrayBuffer;
  language?: string;
  prompt?: string;
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResult {
  text: string;
  segments: TranscriptionSegment[];
  language?: string;
  duration?: number;
  warnings?: string[];
}

// ============================================================================
// Sync Model (Lipsync)
// ============================================================================

export interface SyncModel extends Model {
  readonly type: "sync";

  doSync(options: SyncOptions): Promise<SyncResult>;
}

export interface SyncOptions {
  video: string | ArrayBuffer;
  audio: string | ArrayBuffer;
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface SyncResult {
  video: MediaResult;
  warnings?: string[];
}

// ============================================================================
// Music Model
// ============================================================================

export interface MusicModel extends Model {
  readonly type: "music";

  doGenerate(options: MusicGenerateOptions): Promise<MusicGenerateResult>;
}

export interface MusicGenerateOptions {
  prompt: string;
  duration?: number;
  tags?: string[];
  abortSignal?: AbortSignal;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface MusicGenerateResult {
  audio: MediaResult;
  duration?: number;
  warnings?: string[];
}

// ============================================================================
// Provider Settings
// ============================================================================

export interface ProviderSettings {
  apiKey?: string;
  baseURL?: string;
}

// ============================================================================
// Cache Options
// ============================================================================

export interface CacheOptions {
  key: string | ((...args: unknown[]) => string);
  ttl?: number | string; // e.g., 3600 or '1h'
  storage?: CacheStorage;
}

export interface CacheStorage {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type AnyModel =
  | VideoModel
  | ImageModel
  | TTSModel
  | TranscriptionModel
  | SyncModel
  | MusicModel;
