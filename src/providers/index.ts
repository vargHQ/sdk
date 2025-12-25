/**
 * Provider exports
 * Central registry of all available providers
 */

export type {
  ApifyProviderConfig,
  ApifyRunResult,
  RunActorOptions,
} from "./apify";
// Apify provider (web scraping / actors)
export {
  ACTORS,
  ApifyProvider,
  apifyProvider,
  downloadVideos,
  getDataset,
  getKeyValueStoreValue,
  getRunInfo,
  runActor,
  waitForRun,
} from "./apify";
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
// ElevenLabs provider (voice/audio)
export {
  ElevenLabsProvider,
  elevenlabsProvider,
  generateMusic as generateMusicElevenlabs,
  generateSoundEffect,
  getVoice,
  listVoices,
  textToSpeech,
  VOICES,
} from "./elevenlabs";
// Fal.ai provider (video/image generation)
export {
  FalProvider,
  falProvider,
  generateImage,
  imageToImage,
  imageToVideo,
  textToMusic,
  textToVideo,
  wan25,
} from "./fal";
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
// Higgsfield provider (Soul image generation)
export {
  BatchSize,
  createSoulId,
  generateSoul,
  HiggsfieldProvider,
  higgsfieldProvider,
  listSoulIds,
  listSoulStyles,
  SoulQuality,
  SoulSize,
} from "./higgsfield";
// Replicate provider (video/image generation)
export {
  MODELS,
  ReplicateProvider,
  replicateProvider,
  runImage,
  runModel,
  runVideo,
} from "./replicate";
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
import { apifyProvider } from "./apify";
import { providers } from "./base";
import { elevenlabsProvider } from "./elevenlabs";
import { falProvider } from "./fal";
import { ffmpegProvider } from "./ffmpeg";
import { fireworksProvider } from "./fireworks";
import { groqProvider } from "./groq";
import { higgsfieldProvider } from "./higgsfield";
import { replicateProvider } from "./replicate";
import { storageProvider } from "./storage";

// Auto-register all providers
providers.register(apifyProvider);
providers.register(falProvider);
providers.register(replicateProvider);
providers.register(elevenlabsProvider);
providers.register(groqProvider);
providers.register(fireworksProvider);
providers.register(higgsfieldProvider);
providers.register(ffmpegProvider);
providers.register(storageProvider);
