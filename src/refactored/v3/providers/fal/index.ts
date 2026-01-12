import type { VideoModel, VideoOutput, VideoProvider } from '../../types'
import { createFalVideoModel, listFalModels } from './fal-video-model'
import type { FalConfig } from './fal-client'

export type { FalConfig }

// ============================================================================
// Fal Provider Interface
// ============================================================================

export interface FalProvider extends VideoProvider {
  /** Create a video model by ID */
  (modelId: string): VideoModel<unknown, VideoOutput>
  /** Create a video model (explicit method) */
  video: (modelId: string) => VideoModel<unknown, VideoOutput>
  /** List available models */
  models: () => string[]
}

// ============================================================================
// Create Fal Provider
// ============================================================================

/**
 * Create a fal provider with custom configuration
 *
 * @example
 * ```ts
 * const customFal = createFal({ apiKey: 'my-key' })
 * await customFal.video('kling-video/v2.5-turbo/pro/image-to-video').run({ ... })
 * ```
 */
export function createFal(config?: FalConfig): FalProvider {
  const provider = ((modelId: string) =>
    createFalVideoModel(modelId, config)) as FalProvider

  // Add .video() method (same as calling provider directly)
  provider.video = (modelId: string) => createFalVideoModel(modelId, config)

  // Add .models() for introspection
  provider.models = listFalModels

  return provider
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default fal provider using environment variables
 *
 * @example
 * ```ts
 * import { fal } from 'varg'
 *
 * // Direct call
 * const { url } = await fal('kling-video/v2.5-turbo/pro/image-to-video').run({
 *   image_url: 'https://example.com/image.jpg',
 *   prompt: 'A woman walking through a garden',
 * })
 *
 * // Using .video() method
 * const result = await fal.video('kling-video/v2.5-turbo/pro/image-to-video').run({
 *   image_url: '...',
 *   prompt: '...',
 * })
 * ```
 */
export const fal = createFal()

