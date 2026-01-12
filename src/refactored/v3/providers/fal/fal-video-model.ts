import { z } from 'zod'
import type { VideoModel, VideoOutput, VideoModelType } from '../../types'
import { getFalClient, type FalConfig } from './fal-client'

// ============================================================================
// Model Definitions (Single source of truth)
// ============================================================================

interface ModelDefinition {
  endpoint: string
  type: VideoModelType
  inputSchema: z.ZodType<unknown>
  /** Transform fal response to VideoOutput */
  transformOutput: (result: unknown) => VideoOutput
}

// Kling Image-to-Video Schema
const klingImageToVideoSchema = z.object({
  prompt: z.string().describe('The prompt to generate the video'),
  image_url: z.string().url().describe('URL of the input image'),
  duration: z.enum(['5', '10']).default('5').describe('Duration in seconds'),
  negative_prompt: z.string().default('blur, distort, and low quality').optional(),
  cfg_scale: z.number().min(0).max(1).default(0.5).optional(),
  tail_image_url: z.string().url().optional().describe('End frame image URL'),
})

// Kling Text-to-Video Schema
const klingTextToVideoSchema = z.object({
  prompt: z.string().describe('The prompt to generate the video'),
  duration: z.enum(['5', '10']).default('5').describe('Duration in seconds'),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1']).default('16:9').optional(),
  negative_prompt: z.string().default('blur, distort, and low quality').optional(),
  cfg_scale: z.number().min(0).max(1).default(0.5).optional(),
})

// Standard video response transformer
const transformVideoResponse = (result: unknown): VideoOutput => {
  const res = result as { video?: { url: string }; seed?: number }
  return {
    url: res.video?.url ?? '',
    seed: res.seed,
    raw: result,
  }
}

// ============================================================================
// MODELS Registry
// ============================================================================

const MODELS: Record<string, ModelDefinition> = {
  // Kling v2.5 Turbo Pro
  'kling-video/v2.5-turbo/pro/image-to-video': {
    endpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    type: 'image-to-video',
    inputSchema: klingImageToVideoSchema,
    transformOutput: transformVideoResponse,
  },
  'kling-video/v2.5-turbo/pro/text-to-video': {
    endpoint: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    type: 'text-to-video',
    inputSchema: klingTextToVideoSchema,
    transformOutput: transformVideoResponse,
  },
}

// ============================================================================
// Model Factory
// ============================================================================

export function createFalVideoModel(
  modelId: string,
  config?: FalConfig
): VideoModel<unknown, VideoOutput> {
  const def = MODELS[modelId]

  if (!def) {
    const available = Object.keys(MODELS).join(', ')
    throw new Error(`Unknown fal model: "${modelId}". Available: ${available}`)
  }

  const client = getFalClient(config)

  return {
    modelId: `fal/${modelId}`,
    provider: 'fal',
    type: def.type,
    inputSchema: def.inputSchema,

    async run(input: unknown): Promise<VideoOutput> {
      // Validate input
      const validated = def.inputSchema.parse(input)

      // Run model
      const result = await client.run(def.endpoint, validated)

      // Transform output
      return def.transformOutput(result)
    },
  }
}

// ============================================================================
// Exports for introspection
// ============================================================================

export function listFalModels(): string[] {
  return Object.keys(MODELS)
}

export function getFalModelDefinition(modelId: string): ModelDefinition | undefined {
  return MODELS[modelId]
}

