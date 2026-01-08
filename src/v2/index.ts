// types

// cache
export { clearCache, withCache } from "./cache";
// ffmpeg utilities
export {
  type AddCaptionsOptions,
  addCaptions,
  type MergeOptions,
  merge,
  type TransformOptions,
  type TrimOptions,
  transform,
  trim,
} from "./ffmpeg";
export { type GenerateImageOptions, generateImage } from "./generate-image";
// high-level functions
export { type GenerateVideoOptions, generateVideo } from "./generate-video";
export { type GenerateVoiceOptions, generateVoice } from "./generate-voice";
export {
  createElevenLabs,
  type ElevenLabsProvider,
  elevenlabs,
  VOICES,
} from "./providers/elevenlabs";
// providers
export { createFal, type FalProvider, fal } from "./providers/fal";
export { createGroq, type GroqProvider, groq } from "./providers/groq";
export {
  createReplicate,
  type ReplicateProvider,
  replicate,
} from "./providers/replicate";
export { type SyncOpts, sync } from "./sync";
export { type TranscribeOpts, transcribe } from "./transcribe";
export * from "./types";
