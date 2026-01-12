// Varg SDK - AI Video Generation (AI SDK style)

// Types
export type {
  VideoModel,
  VideoOutput,
  VideoModelType,
  VideoProvider,
  GenerateVideoOptions,
  GenerateVideoResult,
} from './types'

// Generate function
export { generateVideo, resolveModel } from './generate'

// Providers
export { fal, createFal, type FalConfig, type FalProvider } from './providers'

