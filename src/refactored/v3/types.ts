import type { z } from 'zod'

// Video model types
export type VideoModelType = 'image-to-video' | 'text-to-video'

// Video output
export interface VideoOutput {
  url: string
  seed?: number
  duration?: number
  raw?: unknown
}

// VideoModel interface (AI SDK style)
export interface VideoModel<TInput = unknown, TOutput = VideoOutput> {
  /** Full model ID (e.g., "fal/kling-video/v2.5-turbo/pro/image-to-video") */
  modelId: string
  /** Provider name (e.g., "fal") */
  provider: string
  /** Model type */
  type: VideoModelType
  /** Input schema for validation */
  inputSchema: z.ZodType<TInput>
  /** Run the model */
  run: (input: TInput) => Promise<TOutput>
}

// Provider interface
export interface VideoProvider {
  (modelId: string): VideoModel<unknown, VideoOutput>
  video: (modelId: string) => VideoModel<unknown, VideoOutput>
}

// Generate video options
export interface GenerateVideoOptions<TInput = unknown> {
  model: VideoModel<TInput, VideoOutput>
  input: TInput
}

// Generate video result
export interface GenerateVideoResult {
  url: string
  seed?: number
  duration?: number
  raw?: unknown
}

