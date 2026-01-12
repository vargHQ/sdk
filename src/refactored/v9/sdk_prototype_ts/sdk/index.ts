/**
 * @varg/sdk
 *
 * AI Video Generation SDK
 *
 * Based on analysis of 272 production scripts.
 *
 * @example
 * ```ts
 * import {
 *   // Providers
 *   fal, higgsfield, elevenlabs, heygen,
 *
 *   // Generation
 *   generateImage, animateImage, generateSpeech, generateLipsync,
 *
 *   // Post-processing
 *   addCaptions, convertAspectRatio, createPackshot, concatVideos,
 *
 *   // Batch processing
 *   batch, parallel, BATCH_SIZES,
 * } from '@varg/sdk'
 *
 * // Define models
 * const soul = higgsfield.image('soul', { style: 'realistic' })
 * const kling = fal.video('kling')
 * const voice = elevenlabs.speech('multilingual_v2', { voice: 'matilda' })
 * const lipsync = fal.lipsync()
 *
 * // Generate
 * const { image } = await generateImage({ model: soul, prompt: '...' })
 * const { video } = await animateImage({ model: kling, image, prompt: '...' })
 * const { speech } = await generateSpeech({ model: voice, text: '...' })
 * const { video: final } = await generateLipsync({ model: lipsync, video, audio: speech })
 *
 * // Post-process
 * const { video: captioned } = await addCaptions({ video: final, text: '...' })
 * const variants = await convertToMultipleRatios({ video: captioned, ratios: ['4:5', '1:1'] })
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Providers
// =============================================================================

export {
  fal,
  higgsfield,
  elevenlabs,
  heygen,
  seedream,
  nanoBanana,
} from './providers'

export type { ModelRef } from './providers'

// =============================================================================
// Types
// =============================================================================

export type {
  // Media
  ImageObject,
  VideoObject,
  AudioObject,

  // Results
  ResultStatus,
  BaseResult,
  ImageResult,
  VideoResult,
  AudioResult,

  // Aspect ratios
  AspectRatio,

  // Provider options
  HiggsfieldOptions,
  KlingOptions,
  ElevenLabsOptions,
  LipsyncOptions,
  CaptionOptions,

  // Config
  S3Config,
  PackshotConfig,
  CropConfig,
  ConcatConfig,

  // Batch
  BatchOptions,
  BatchResult,

  // Campaign
  Character,
  CampaignConfig,
  CharacterResult,
} from './types'

export { ASPECT_RATIO_DIMENSIONS } from './types'

// =============================================================================
// Generation Functions
// =============================================================================

export {
  generateImage,
  animateImage,
  generateSpeech,
  generateLipsync,
  generateTalkingHead,
  transformImage,
} from './generate'

export type {
  GenerateImageOptions,
  AnimateImageOptions,
  GenerateSpeechOptions,
  GenerateLipsyncOptions,
  GenerateTalkingHeadOptions,
  TransformImageOptions,
} from './generate'

// =============================================================================
// Post-Processing Functions
// =============================================================================

export {
  addCaptions,
  convertAspectRatio,
  convertToMultipleRatios,
  createPackshot,
  concatVideos,
  addVoiceover,
  addMusic,
  addTitle,
} from './postprocess'

export type {
  AddCaptionsOptions,
  ConvertAspectRatioOptions,
  CreatePackshotOptions,
  ConcatVideosOptions,
  AddVoiceoverOptions,
  AddMusicOptions,
  AddTitleOptions,
} from './postprocess'

// =============================================================================
// Batch Processing
// =============================================================================

export {
  batch,
  parallel,
  pipeline,
  retry,
  checkpoint,
  BATCH_SIZES,
  BATCH_DELAYS,
} from './batch'
