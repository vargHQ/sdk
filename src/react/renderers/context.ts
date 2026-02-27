import type { generateImage } from "ai";
import type { CacheStorage } from "../../ai-sdk/cache";
import type { File } from "../../ai-sdk/file";
import type { generateVideo } from "../../ai-sdk/generate-video";
import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends";
import type { StorageProvider } from "../../ai-sdk/storage/types";
import type { DefaultModels } from "../types";
import type { ProgressTracker } from "./progress";

export interface RenderContext {
  width: number;
  height: number;
  fps: number;
  cache?: CacheStorage;
  storage?: StorageProvider;
  generateImage: typeof generateImage;
  generateVideo: typeof generateVideo;
  tempFiles: string[];
  progress?: ProgressTracker;
  pendingFiles: Map<string, Promise<File>>;
  defaults?: DefaultModels;
  backend: FFmpegBackend;
  generatedFiles: File[];
}
