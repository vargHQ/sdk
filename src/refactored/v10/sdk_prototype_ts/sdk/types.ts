/**
 * Core types for @varg/sdk
 */

// Media objects
export interface ImageFile {
  url: string
  width?: number
  height?: number
  mediaType?: string
}

export interface VideoFile {
  url: string
  duration?: number
  width?: number
  height?: number
}

export interface AudioFile {
  url: string
  duration?: number
  mediaType?: string
}

// Aspect ratios
export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9'

// Provider options
export type ProviderOptions = Record<string, Record<string, unknown>>
