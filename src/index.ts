/**
 * varg.ai SDK
 * AI video generation and editing tools
 */

// Re-export external clients for convenience
export { fal } from "@ai-sdk/fal";
export { google } from "@ai-sdk/google";
export { replicate } from "@ai-sdk/replicate";
export { fal as falClient } from "@fal-ai/client";
export { HiggsfieldClient } from "@higgsfield/client";
// Core exports
export * from "./core";
export type {
  ActionDefinition,
  Definition,
  ExecutionResult,
  InferInput,
  InferOutput,
  Job,
  JobStatus,
  JsonSchema,
  ModelDefinition,
  Provider,
  ProviderConfig,
  RunOptions,
  SchemaProperty,
  SkillDefinition,
  VargConfig,
  ZodSchema,
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
  chatCompletion,
  concatVideos,
  convertFireworksToSRT,
  convertFormat,
  downloadToFile,
  ensureUrl,
  extractAudio,
  // FFmpeg
  FFmpegProvider,
  // Fireworks
  FireworksProvider,
  fadeVideo,
  ffmpegProvider,
  fireworksProvider,
  GROQ_MODELS,
  // Groq
  GroqProvider,
  generatePresignedUrl,
  getExtension,
  getPublicUrl,
  getVideoDuration,
  groqProvider,
  listModels,
  ProviderRegistry,
  probe,
  providers,
  resizeVideo,
  // Storage
  StorageProvider,
  splitAtTimestamps,
  storageProvider,
  transcribeWithFireworks,
  trimVideo,
  uploadBuffer,
  uploadFile,
  uploadFromUrl,
  xfadeVideos,
} from "./providers";
