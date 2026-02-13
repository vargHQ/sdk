/**
 * Provider exports
 * Local processing tools and infrastructure providers
 */

export type { ProviderResult } from "./base";
// Base provider infrastructure
export {
  BaseProvider,
  downloadToFile,
  ensureUrl,
  getExtension,
  ProviderRegistry,
  providers,
} from "./base";
export type { ProbeResult } from "./ffmpeg";
// FFmpeg provider (local video editing)
export {
  addAudio,
  concatVideos,
  convertFormat,
  extractAudio,
  FFmpegProvider,
  fadeVideo,
  ffmpegProvider,
  getVideoDuration,
  probe,
  resizeVideo,
  splitAtTimestamps,
  trimVideo,
  xfadeVideos,
} from "./ffmpeg";
export type { FireworksResponse, FireworksWord } from "./fireworks";
// Fireworks provider (transcription)
export {
  convertFireworksToSRT,
  FireworksProvider,
  fireworksProvider,
  transcribeWithFireworks,
} from "./fireworks";
// Groq provider (LLM inference)
export {
  chatCompletion,
  GROQ_MODELS,
  GroqProvider,
  groqProvider,
  listModels,
  transcribeAudio,
} from "./groq";
export type { StorageConfig } from "./storage";
// Storage provider (Cloudflare R2 / S3)
export {
  generatePresignedUrl,
  getPublicUrl,
  StorageProvider,
  storageProvider,
  uploadBuffer,
  uploadFile,
  uploadFromUrl,
} from "./storage";

// Register all providers
import { providers } from "./base";
import { ffmpegProvider } from "./ffmpeg";
import { fireworksProvider } from "./fireworks";
import { groqProvider } from "./groq";
import { storageProvider } from "./storage";

providers.register(ffmpegProvider);
providers.register(groqProvider);
providers.register(fireworksProvider);
providers.register(storageProvider);
