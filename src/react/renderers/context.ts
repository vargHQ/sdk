import type { generateImage } from "ai";
import type { CacheStorage } from "../../ai-sdk/cache";
import type { generateVideo } from "../../ai-sdk/generate-video";
import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends/types";
import type { DefaultModels } from "../types";
import type { ProgressTracker } from "./progress";

export interface RenderContext {
  width: number;
  height: number;
  fps: number;
  cache?: CacheStorage;
  generateImage: typeof generateImage;
  generateVideo: typeof generateVideo;
  tempFiles: string[];
  progress?: ProgressTracker;
  /** In-memory deduplication for concurrent renders of the same element */
  pending: Map<string, Promise<string>>;
  /** Default models for elements that don't specify one */
  defaults?: DefaultModels;
  /** Backend for ffmpeg operations (local or cloud like Rendi) */
  backend?: FFmpegBackend;
}

/**
 * Check if the backend requires URLs instead of local file paths.
 * Cloud backends like Rendi need URLs for all inputs.
 */
export function isCloudBackend(backend?: FFmpegBackend): boolean {
  return backend?.name === "rendi";
}
