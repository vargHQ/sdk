/**
 * @varg/sdk - AI Video Generation SDK
 *
 * @example
 * ```ts
 * import { fal, higgsfield, elevenlabs, generateImage, animateImage, generateSpeech, generateLipsync } from '@varg/sdk'
 *
 * const { image } = await generateImage({
 *   model: higgsfield.image('soul'),
 *   prompt: 'A 35-year-old woman smiling at camera',
 *   aspectRatio: '9:16',
 * })
 *
 * const { video } = await animateImage({
 *   model: fal.video('kling'),
 *   image,
 *   prompt: 'Person speaking naturally',
 *   duration: 5,
 * })
 *
 * const { audio } = await generateSpeech({
 *   model: elevenlabs.speech('multilingual_v2', { voice: 'matilda' }),
 *   text: 'Hello, welcome to our product.',
 * })
 *
 * const { video: final } = await generateLipsync({
 *   model: fal.lipsync(),
 *   video,
 *   audio,
 * })
 * ```
 */

// Types
export type { ImageFile, VideoFile, AudioFile, AspectRatio } from './types'

// Providers
export { fal, higgsfield, elevenlabs, heygen } from './providers'
export type { ImageModel, VideoModel, SpeechModel, LipsyncModel } from './providers'

// Generation
export { generateImage, animateImage, generateSpeech, generateLipsync, transformImage } from './generate'

// Post-processing
export { addCaptions, convertAspectRatio, createPackshot, concatVideos, addVoiceover, addMusic, addTitle } from './postprocess'

// Batch utilities
export { batch, parallel } from './batch'
export type { BatchResult } from './batch'
