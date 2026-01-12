/**
 * Post-processing functions for video editing
 */

import type { VideoFile, ImageFile, AudioFile, AspectRatio } from './types'

export interface PostProcessResult {
  video: VideoFile
  warnings: string[]
}

/**
 * Add captions to a video.
 */
export async function addCaptions({
  video,
  text,
  style,
}: {
  video: VideoFile | string
  text: string
  style?: {
    position?: 'top' | 'center' | 'bottom'
    fontSize?: number
    useBounce?: boolean
  }
}): Promise<PostProcessResult> {
  const videoFile = typeof video === 'string' ? { url: video } : video
  return {
    video: {
      url: `${videoFile.url.replace('.mp4', '')}_captioned.mp4`,
      duration: videoFile.duration,
    },
    warnings: [],
  }
}

/**
 * Convert video to a different aspect ratio.
 */
export async function convertAspectRatio({
  video,
  targetRatio,
  addBlurredBackground,
}: {
  video: VideoFile | string
  targetRatio: AspectRatio
  addBlurredBackground?: boolean
}): Promise<PostProcessResult> {
  const videoFile = typeof video === 'string' ? { url: video } : video
  return {
    video: {
      url: `${videoFile.url.replace('.mp4', '')}_${targetRatio.replace(':', 'x')}.mp4`,
      duration: videoFile.duration,
    },
    warnings: [],
  }
}

/**
 * Create a packshot (end card) video.
 */
export async function createPackshot({
  config,
  duration = 5,
}: {
  config: {
    backgroundImage: ImageFile | string
    title: string
    buttonText: string
    buttonColor?: string
    blurIntensity?: number
  }
  duration?: number
}): Promise<PostProcessResult> {
  return {
    video: {
      url: `https://api.varg.ai/generated/${Date.now()}_packshot.mp4`,
      duration,
    },
    warnings: [],
  }
}

/**
 * Concatenate multiple videos.
 */
export async function concatVideos({
  videos,
  transition,
  transitionDuration,
}: {
  videos: Array<VideoFile | string>
  transition?: 'none' | 'crossfade'
  transitionDuration?: number
}): Promise<PostProcessResult> {
  const totalDuration = videos.reduce((acc, v) => {
    const file = typeof v === 'string' ? { duration: 5 } : v
    return acc + (file.duration ?? 5)
  }, 0)

  return {
    video: {
      url: `https://api.varg.ai/generated/${Date.now()}_concat.mp4`,
      duration: totalDuration,
    },
    warnings: [],
  }
}

/**
 * Add voiceover audio to a video.
 */
export async function addVoiceover({
  video,
  audio,
}: {
  video: VideoFile | string
  audio: AudioFile | string
}): Promise<PostProcessResult> {
  const videoFile = typeof video === 'string' ? { url: video } : video
  return {
    video: {
      url: `${videoFile.url.replace('.mp4', '')}_voiced.mp4`,
      duration: videoFile.duration,
    },
    warnings: [],
  }
}

/**
 * Add background music to a video.
 */
export async function addMusic({
  video,
  musicUrl,
  volume,
}: {
  video: VideoFile | string
  musicUrl: string
  volume?: number
}): Promise<PostProcessResult> {
  const videoFile = typeof video === 'string' ? { url: video } : video
  return {
    video: {
      url: `${videoFile.url.replace('.mp4', '')}_music.mp4`,
      duration: videoFile.duration,
    },
    warnings: [],
  }
}

/**
 * Add a text title overlay to a video.
 */
export async function addTitle({
  video,
  title,
  position,
  style,
}: {
  video: VideoFile | string
  title: string
  position?: 'top' | 'center' | 'bottom'
  style?: {
    fontSize?: number
    color?: string
    animation?: 'none' | 'fade-in'
  }
}): Promise<PostProcessResult> {
  const videoFile = typeof video === 'string' ? { url: video } : video
  return {
    video: {
      url: `${videoFile.url.replace('.mp4', '')}_titled.mp4`,
      duration: videoFile.duration,
    },
    warnings: [],
  }
}
