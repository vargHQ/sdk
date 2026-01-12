/**
 * Provider implementations following Vercel AI SDK patterns
 */

// Model interfaces
export interface ImageModel {
  readonly specificationVersion: 'v1'
  readonly provider: string
  readonly modelId: string
  readonly modelType: 'image'
}

export interface VideoModel {
  readonly specificationVersion: 'v1'
  readonly provider: string
  readonly modelId: string
  readonly modelType: 'video'
}

export interface SpeechModel {
  readonly specificationVersion: 'v1'
  readonly provider: string
  readonly modelId: string
  readonly modelType: 'speech'
  readonly defaultVoice?: string
}

export interface LipsyncModel {
  readonly specificationVersion: 'v1'
  readonly provider: string
  readonly modelId: string
  readonly modelType: 'lipsync'
}

// Fal provider
export type FalVideoModelId = 'kling' | 'kling-standard' | 'minimax' | (string & {})
export type FalImageModelId = 'flux-pro' | 'flux-schnell' | 'nano-banana' | (string & {})
export type FalLipsyncModelId = 'sync-lipsync' | (string & {})

const FAL_VIDEO_MODELS: Record<string, string> = {
  'kling': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  'kling-standard': 'fal-ai/kling-video/v2/standard/image-to-video',
  'minimax': 'fal-ai/minimax-video/image-to-video',
}

const FAL_IMAGE_MODELS: Record<string, string> = {
  'flux-pro': 'fal-ai/flux-pro/v1.1-ultra',
  'flux-schnell': 'fal-ai/flux/schnell',
  'nano-banana': 'fal-ai/nano-banana-pro',
}

export interface FalProvider {
  video(modelId?: FalVideoModelId): VideoModel
  image(modelId?: FalImageModelId): ImageModel
  lipsync(modelId?: FalLipsyncModelId): LipsyncModel
}

function createFal(): FalProvider {
  return {
    video: (modelId = 'kling') => ({
      specificationVersion: 'v1',
      provider: 'fal',
      modelId: FAL_VIDEO_MODELS[modelId] ?? modelId,
      modelType: 'video',
    }),
    image: (modelId = 'flux-pro') => ({
      specificationVersion: 'v1',
      provider: 'fal',
      modelId: FAL_IMAGE_MODELS[modelId] ?? modelId,
      modelType: 'image',
    }),
    lipsync: (modelId = 'sync-lipsync') => ({
      specificationVersion: 'v1',
      provider: 'fal',
      modelId: 'fal-ai/sync-lipsync/v2/pro',
      modelType: 'lipsync',
    }),
  }
}

export const fal = createFal()

// Higgsfield provider
export type HiggsfieldModelId = 'soul' | (string & {})

export interface HiggsfieldProvider {
  image(modelId?: HiggsfieldModelId): ImageModel
}

function createHiggsfield(): HiggsfieldProvider {
  return {
    image: (modelId = 'soul') => ({
      specificationVersion: 'v1',
      provider: 'higgsfield',
      modelId: `higgsfield/${modelId}`,
      modelType: 'image',
    }),
  }
}

export const higgsfield = createHiggsfield()

// ElevenLabs provider
export type ElevenLabsModelId = 'multilingual_v2' | 'turbo_v2_5' | (string & {})
export type ElevenLabsVoiceId =
  | 'rachel' | 'matilda' | 'freya' | 'callum' | 'dorothy'
  | 'bella' | 'alice' | 'charlotte' | 'emily' | 'ryan'
  | (string & {})

const ELEVENLABS_MODELS: Record<string, string> = {
  'multilingual_v2': 'eleven_multilingual_v2',
  'turbo_v2_5': 'eleven_turbo_v2_5',
}

const ELEVENLABS_VOICES: Record<string, string> = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  matilda: 'XrExE9yKIg1WjnnlVkGX',
  freya: 'jsCqWAovK2LkecY7zXl4',
  callum: 'N2lVS1w4EtoT3dr4eOWO',
  dorothy: 'ThT5KcBeYPX3keUQqHPh',
  bella: 'EXAVITQu4vr4xnSDxMaL',
  alice: 'Xb7hH8MSUJpSbSDYk0k2',
  charlotte: 'XB0fDUnXU5powFXDhCwa',
  emily: 'LcfcDJNUP1GQjkzn1xUU',
  ryan: 'wViXBPUzp2ZZixB1xQuM',
}

export interface ElevenLabsProvider {
  speech(modelId?: ElevenLabsModelId, options?: { voice?: ElevenLabsVoiceId }): SpeechModel
  getVoiceId(name: ElevenLabsVoiceId): string
}

function createElevenLabs(): ElevenLabsProvider {
  return {
    speech: (modelId = 'multilingual_v2', options) => ({
      specificationVersion: 'v1',
      provider: 'elevenlabs',
      modelId: ELEVENLABS_MODELS[modelId] ?? modelId,
      modelType: 'speech',
      defaultVoice: options?.voice
        ? (ELEVENLABS_VOICES[options.voice] ?? options.voice)
        : undefined,
    }),
    getVoiceId: (name) => ELEVENLABS_VOICES[name] ?? name,
  }
}

export const elevenlabs = createElevenLabs()

// HeyGen provider
export interface HeyGenProvider {
  video(): VideoModel
}

function createHeyGen(): HeyGenProvider {
  return {
    video: () => ({
      specificationVersion: 'v1',
      provider: 'heygen',
      modelId: 'avatar-iv',
      modelType: 'video',
    }),
  }
}

export const heygen = createHeyGen()
