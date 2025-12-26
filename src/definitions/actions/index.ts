/**
 * Action definitions index
 */

export type { AddCaptionsOptions, SubtitleStyle } from "./captions";
// Captions
export { addCaptions, definition as captions } from "./captions";
export type {
  CutOptions,
  CutResult,
  FadeOptions,
  FadeResult,
  MergeOptions,
  MergeResult,
  RemoveOptions,
  RemoveResult,
  SplitOptions,
  SplitResult,
  TransitionOptions,
  TransitionResult,
  TrimOptions,
  TrimResult,
} from "./edit";
// Video editing (FFmpeg)
export {
  cut,
  cutDefinition,
  fade,
  fadeDefinition,
  merge,
  mergeDefinition,
  remove,
  removeDefinition,
  split,
  splitDefinition,
  transition,
  transitionDefinition,
  trim,
  trimDefinition,
} from "./edit";
export type { ImageGenerationResult } from "./image";
// Image generation
export {
  definition as image,
  generateWithFal,
  generateWithSoul,
} from "./image";
export type { GenerateMusicOptions, MusicResult } from "./music";
// Music generation
export { definition as music, generateMusic } from "./music";
export type { LipsyncOptions, LipsyncResult, Wav2LipOptions } from "./sync";
// Lip sync
export {
  definition as sync,
  lipsync,
  lipsyncOverlay,
  lipsyncWav2Lip,
} from "./sync";
export type { TranscribeOptions, TranscribeResult } from "./transcribe";
// Transcription
export {
  definition as transcribe,
  transcribe as transcribeAudio,
} from "./transcribe";
export type { UploadOptions, UploadResult } from "./upload";
// Upload
export { definition as uploadDef, upload } from "./upload";
export type { VideoGenerationResult } from "./video";
// Video generation
export {
  definition as video,
  generateVideoFromImage,
  generateVideoFromText,
} from "./video";
export type { GenerateVoiceOptions, VoiceResult } from "./voice";
// Voice generation
export { definition as voice, generateVoice } from "./voice";

// All action definitions for auto-loading
import { definition as captionsDefinition } from "./captions";
import {
  cutDefinition,
  fadeDefinition,
  mergeDefinition,
  removeDefinition,
  splitDefinition,
  transitionDefinition,
  trimDefinition,
} from "./edit";
import { definition as imageDefinition } from "./image";
import { definition as musicDefinition } from "./music";
import { definition as syncDefinition } from "./sync";
import { definition as transcribeDefinition } from "./transcribe";
import { definition as uploadDefinition } from "./upload";
import { definition as videoDefinition } from "./video";
import { definition as voiceDefinition } from "./voice";

export const allActions = [
  videoDefinition,
  imageDefinition,
  voiceDefinition,
  transcribeDefinition,
  musicDefinition,
  syncDefinition,
  captionsDefinition,
  trimDefinition,
  cutDefinition,
  mergeDefinition,
  splitDefinition,
  fadeDefinition,
  transitionDefinition,
  removeDefinition,
  uploadDefinition,
];
