/**
 * varg.ai sdk
 * video generation and editing tools
 */

// re-export external clients
export { fal } from "@ai-sdk/fal";
export { replicate } from "@ai-sdk/replicate";
export { fal as falClient } from "@fal-ai/client";
export { HiggsfieldClient } from "@higgsfield/client";
// action exports (excluding meta to avoid conflicts)
export {
  type AddCaptionsOptions,
  addCaptions,
  type SubtitleStyle,
} from "./action/captions";
export {
  type CreateMontageOptions,
  createMontage,
  type EditPipelineOptions,
  type EditPipelineStep,
  editPipeline,
  mergeWithAudio,
  type PrepareForSocialOptions,
  prepareForSocial,
  quickResize,
  quickTrim,
} from "./action/edit";
export {
  generateWithFal,
  generateWithSoul,
  type ImageGenerationResult,
} from "./action/image";
export {
  type LipsyncOptions,
  lipsync,
  lipsyncOverlay,
  lipsyncWav2Lip,
  type Wav2LipOptions,
} from "./action/sync";
export {
  type TranscribeOptions,
  type TranscribeResult,
  transcribe,
} from "./action/transcribe";
export {
  generateVideoFromImage,
  generateVideoFromText,
  type VideoGenerationResult,
} from "./action/video";
export {
  type GenerateVoiceOptions,
  generateVoice,
  type VoiceResult,
} from "./action/voice";
// lib exports - ai-sdk/fal (provider)
export * as aiSdkFal from "./lib/ai-sdk/fal";
// lib exports - ai-sdk/replicate (provider)
export * as aiSdkReplicate from "./lib/ai-sdk/replicate";
// lib exports - elevenlabs
export * from "./lib/elevenlabs";
// lib exports - fal (client)
export * from "./lib/fal";
// lib exports - ffmpeg
export * from "./lib/ffmpeg";
// lib exports - fireworks
export * from "./lib/fireworks";
// lib exports - groq
export * from "./lib/groq";
// lib exports - higgsfield
export * from "./lib/higgsfield";
// lib exports - replicate
export * from "./lib/replicate";
// utilities exports
export * from "./utilities/s3";
