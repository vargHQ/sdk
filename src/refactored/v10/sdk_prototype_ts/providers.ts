/**
 * VARG AI SDK - Provider Definitions
 *
 * Provider abstraction layer for switching between AI services.
 * Inspired by Vercel AI SDK patterns.
 */

// =============================================================================
// Core Types
// =============================================================================

export type MediaType = 'image' | 'video' | 'audio';

export interface ModelRef {
  provider: string;
  modelId: string;
  mediaType: MediaType;
  defaultParams?: Record<string, unknown>;
}

export interface ImageObject {
  url: string;
  mediaType: 'image';
  width?: number;
  height?: number;
  format?: string;
}

export interface VideoObject {
  url: string;
  mediaType: 'video';
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  format?: string;
}

export interface AudioObject {
  url: string;
  mediaType: 'audio';
  duration?: number;
  sampleRate?: number;
  format?: string;
}

// =============================================================================
// Provider Implementations
// =============================================================================

interface FalProvider {
  image: (modelId: string, defaults?: Record<string, unknown>) => ModelRef;
  video: (modelId: string, defaults?: Record<string, unknown>) => ModelRef;
  lipsync: (modelId?: string, defaults?: Record<string, unknown>) => ModelRef;
}

interface HiggsfieldProvider {
  image: (modelId?: string, defaults?: Record<string, unknown>) => ModelRef;
}

interface ElevenLabsProvider {
  speech: (modelId?: string, defaults?: Record<string, unknown>) => ModelRef;
}

interface HeyGenProvider {
  video: (modelId?: string, defaults?: Record<string, unknown>) => ModelRef;
  talkingHead: (defaults?: Record<string, unknown>) => ModelRef;
}

// Model shortcuts
const FAL_MODELS = {
  // Image
  'flux-pro': 'fal-ai/flux-pro/v1.1-ultra',
  'flux-schnell': 'fal-ai/flux/schnell',
  'nano-banana': 'fal-ai/nano-banana-pro',

  // Video
  'kling': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  'kling-standard': 'fal-ai/kling-video/v2/standard/image-to-video',
  'minimax': 'fal-ai/minimax-video/image-to-video',

  // Lipsync
  'lipsync': 'fal-ai/sync-lipsync/v2/pro',
} as const;

const HIGGSFIELD_MODELS = {
  'soul': 'higgsfield/soul',
  'soul-v2': 'higgsfield/soul-v2',
} as const;

const HIGGSFIELD_STYLES = {
  'realistic': '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe',
  'cinematic': 'cinematic-style-id',
  'anime': 'anime-style-id',
} as const;

const ELEVENLABS_MODELS = {
  'multilingual_v2': 'eleven_multilingual_v2',
  'turbo_v2_5': 'eleven_turbo_v2_5',
  'monolingual_v1': 'eleven_monolingual_v1',
} as const;

const ELEVENLABS_VOICES = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'domi': 'AZnzlk1XvdvUeBnXmlld',
  'bella': 'EXAVITQu4vr4xnSDxMaL',
  'matilda': 'XrExE9yKIg1WjnnlVkGX',
  'freya': 'jsCqWAovK2LkecY7zXl4',
  'callum': 'N2lVS1w4EtoT3dr4eOWO',
  'dorothy': 'ThT5KcBeYPX3keUQqHPh',
} as const;

// =============================================================================
// Provider Instances
// =============================================================================

export const fal: FalProvider = {
  image: (modelId: string, defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'fal',
    modelId: FAL_MODELS[modelId as keyof typeof FAL_MODELS] || modelId,
    mediaType: 'image',
    defaultParams: defaults,
  }),

  video: (modelId: string, defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'fal',
    modelId: FAL_MODELS[modelId as keyof typeof FAL_MODELS] || modelId,
    mediaType: 'video',
    defaultParams: defaults,
  }),

  lipsync: (modelId = 'lipsync', defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'fal',
    modelId: FAL_MODELS[modelId as keyof typeof FAL_MODELS] || modelId,
    mediaType: 'video',
    defaultParams: defaults,
  }),
};

export const higgsfield: HiggsfieldProvider = {
  image: (modelId = 'soul', defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'higgsfield',
    modelId: HIGGSFIELD_MODELS[modelId as keyof typeof HIGGSFIELD_MODELS] || modelId,
    mediaType: 'image',
    defaultParams: defaults,
  }),
};

export const elevenlabs: ElevenLabsProvider = {
  speech: (modelId = 'multilingual_v2', defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'elevenlabs',
    modelId: ELEVENLABS_MODELS[modelId as keyof typeof ELEVENLABS_MODELS] || modelId,
    mediaType: 'audio',
    defaultParams: defaults,
  }),
};

export const heygen: HeyGenProvider = {
  video: (modelId = 'avatar-iv', defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'heygen',
    modelId,
    mediaType: 'video',
    defaultParams: defaults,
  }),

  talkingHead: (defaults?: Record<string, unknown>): ModelRef => ({
    provider: 'heygen',
    modelId: 'avatar-iv',
    mediaType: 'video',
    defaultParams: defaults,
  }),
};

// =============================================================================
// Utilities
// =============================================================================

export function getVoiceId(voiceName: string): string {
  return ELEVENLABS_VOICES[voiceName as keyof typeof ELEVENLABS_VOICES] || voiceName;
}

export function getStyleId(styleName: string): string {
  return HIGGSFIELD_STYLES[styleName as keyof typeof HIGGSFIELD_STYLES] || styleName;
}
