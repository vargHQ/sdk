import type { generateImage } from "ai";
import type { fileCache } from "../../file-cache";
import type { generateVideo } from "../../generate-video";
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
}
