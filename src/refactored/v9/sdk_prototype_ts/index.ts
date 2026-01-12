/**
 * VARG AI SDK
 *
 * A clean, composable API for AI video generation.
 * Inspired by Vercel AI SDK design patterns.
 *
 * @example
 * ```ts
 * import {
 *   generateImage,
 *   animateImage,
 *   generateSpeech,
 *   generateLipSyncVideo,
 *   fal,
 *   higgsfield,
 *   elevenlabs,
 * } from '@varg/sdk';
 *
 * // Define models
 * const soul = higgsfield.image('soul');
 * const kling = fal.video('kling');
 * const voice = elevenlabs.speech('multilingual_v2');
 * const lipsync = fal.lipsync();
 *
 * // Generate talking head video
 * const { image } = await generateImage({
 *   model: soul,
 *   prompt: '...',
 *   aspectRatio: '9:16',
 * });
 *
 * const { video } = await animateImage({
 *   model: kling,
 *   image,
 *   prompt: '...',
 *   duration: 5,
 * });
 *
 * const { speech } = await generateSpeech({
 *   model: voice,
 *   text: '...',
 * });
 *
 * const { video: final } = await generateLipSyncVideo({
 *   model: lipsync,
 *   video,
 *   audio: speech,
 * });
 *
 * console.log(final.url);
 * ```
 *
 * @packageDocumentation
 */

// Providers
export {
  fal,
  higgsfield,
  elevenlabs,
  heygen,
  getVoiceId,
  getStyleId,
} from './providers';

// Types
export type {
  ModelRef,
  ImageObject,
  VideoObject,
  AudioObject,
  MediaType,
} from './providers';

// Generation functions
export {
  generateImage,
  animateImage,
  generateSpeech,
  generateLipSyncVideo,
  generateTalkingHead,
} from './core';

// Result types
export type {
  GenerateImageResult,
  AnimateImageResult,
  GenerateSpeechResult,
  GenerateLipSyncVideoResult,
  GenerateTalkingHeadResult,
} from './core';

// Option types
export type {
  GenerateImageOptions,
  AnimateImageOptions,
  GenerateSpeechOptions,
  GenerateLipSyncVideoOptions,
  GenerateTalkingHeadOptions,
  OnProgressCallback,
} from './core';
