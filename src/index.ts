/**
 * varg.ai SDK
 * AI video generation and editing tools
 */

// Re-export external clients for convenience
export { fal } from "@ai-sdk/fal";
export { replicate } from "@ai-sdk/replicate";
export { fal as falClient } from "@fal-ai/client";
export { HiggsfieldClient } from "@higgsfield/client";
// Core exports
export * from "./core";
export type {
  ActionDefinition,
  Definition,
  ExecutionResult,
  Job,
  JobStatus,
  ModelDefinition,
  Provider,
  ProviderConfig,
  RunOptions,
  SkillDefinition,
  VargConfig,
} from "./core/schema/types";
// Definition exports
export * from "./definitions";
export type {
  FireworksResponse,
  FireworksWord,
  ProbeResult,
  ProviderResult,
  StorageConfig,
} from "./providers";
// Provider exports (excluding transcribeAudio to avoid conflict with definitions)

export {
  addAudio,
  // Base
  BaseProvider,
  BatchSize,
  chatCompletion,
  concatVideos,
  convertFireworksToSRT,
  convertFormat,
  createSoulId,
  downloadToFile,
  // ElevenLabs
  ElevenLabsProvider,
  elevenlabsProvider,
  ensureUrl,
  extractAudio,
  // Fal
  FalProvider,
  // FFmpeg
  FFmpegProvider,
  // Fireworks
  FireworksProvider,
  fadeVideo,
  falProvider,
  ffmpegProvider,
  fireworksProvider,
  GROQ_MODELS,
  // Groq
  GroqProvider,
  generateImage,
  generateMusicElevenlabs,
  generatePresignedUrl,
  generateSoul,
  generateSoundEffect,
  getExtension,
  getPublicUrl,
  getVideoDuration,
  getVoice,
  groqProvider,
  // Higgsfield
  HiggsfieldProvider,
  higgsfieldProvider,
  imageToImage,
  imageToVideo,
  listModels,
  listSoulIds,
  listSoulStyles,
  listVoices,
  MODELS,
  ProviderRegistry,
  probe,
  providers,
  // Replicate
  ReplicateProvider,
  replicateProvider,
  resizeVideo,
  runImage,
  runModel,
  runVideo,
  SoulQuality,
  SoulSize,
  // Storage
  StorageProvider,
  splitAtTimestamps,
  storageProvider,
  textToMusic,
  textToSpeech,
  textToVideo,
  transcribeWithFireworks,
  trimVideo,
  uploadBuffer,
  uploadFile,
  uploadFromUrl,
  VOICES,
  wan25,
  xfadeVideos,
} from "./providers";
