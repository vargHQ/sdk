import type { generateImage } from "ai";
import type { fileCache } from "../../ai-sdk/file-cache";
import type { generateVideo } from "../../ai-sdk/generate-video";
import type { DefaultModels } from "../types";
import type { ProgressTracker } from "./progress";

export interface RenderContext {
  width: number;
  height: number;
  fps: number;
  cache?: ReturnType<typeof fileCache>;
  generateImage: typeof generateImage;
  generateVideo: typeof generateVideo;
  tempFiles: string[];
  progress?: ProgressTracker;
  /** In-memory deduplication for concurrent renders of the same element */
  pending: Map<string, Promise<string>>;
  /** Default models for elements that don't specify one */
  defaults?: DefaultModels;
}
