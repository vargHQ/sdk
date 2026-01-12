// packages/sdk/src/index.ts

// ============================================
// TYPES
// ============================================

export type {
  // Model specifications
  ImageModelV1,
  VideoModelV1,
  AudioModelV1,
  ModelType,
  // Model params (internal)
  ImageModelParams,
  VideoModelParams,
  AudioModelParams,
  // Model results (internal)
  ImageModelResult,
  VideoModelResult,
  AudioModelResult,
  // Assets
  ImageAsset,
  VideoAsset,
  AspectRatio,
  GeneratedFile,
  // Public results
  GeneratedImage,
  GeneratedVideo,
  GeneratedAudio,
  GenerateImageResult,
  GenerateVideoResult,
  GenerateAudioResult,
} from './types';

// ============================================
// GENERATE FUNCTIONS
// ============================================

export { generateImage } from './generate-image';
export type { GenerateImageParams } from './generate-image';

export { generateVideo, animateImage } from './generate-video';
export type { GenerateVideoParams, AnimateImageParams } from './generate-video';

export { generateMusic, generateSpeech, generateSound } from './generate-audio';
export type {
  GenerateMusicParams,
  GenerateSpeechParams,
  GenerateSoundParams,
} from './generate-audio';

// ============================================
// UTILS
// ============================================

export { normalizeImageAsset, normalizeVideoAsset, sleep } from './utils';
