import type { VideoModel, VideoOutput, GenerateVideoOptions, GenerateVideoResult } from './types'
import { fal } from './providers'

// ============================================================================
// Generate Video (AI SDK style)
// ============================================================================

/**
 * Generate a video using a model
 *
 * @example
 * ```ts
 * import { generateVideo, fal } from 'varg'
 *
 * const { url } = await generateVideo({
 *   model: fal.video('kling-video/v2.5-turbo/pro/image-to-video'),
 *   input: {
 *     image_url: 'https://example.com/image.jpg',
 *     prompt: 'A woman walking through a garden',
 *   },
 * })
 * ```
 */
export async function generateVideo<TInput>(
  options: GenerateVideoOptions<TInput>
): Promise<GenerateVideoResult> {
  const { model, input } = options

  const result = await model.run(input)

  return {
    url: result.url,
    seed: result.seed,
    duration: result.duration,
    raw: result.raw,
  }
}

// ============================================================================
// Model Resolution (for string-based model IDs)
// ============================================================================

/**
 * Resolve a model ID string to a VideoModel instance
 *
 * @example
 * ```ts
 * const model = resolveModel('fal/kling-video/v2.5-turbo/pro/image-to-video')
 * await model.run({ ... })
 * ```
 */
export function resolveModel(modelId: string): VideoModel<unknown, VideoOutput> {
  const [provider, ...rest] = modelId.split('/')
  const path = rest.join('/')

  switch (provider) {
    case 'fal':
      return fal.video(path)
    default:
      throw new Error(`Unknown provider: "${provider}". Available: fal`)
  }
}
