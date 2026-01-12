// packages/sdk/src/utils.ts

import type { ImageAsset, VideoAsset, GeneratedImage, GeneratedVideo } from './types';

export async function normalizeImageAsset(image: ImageAsset): Promise<string> {
  if (typeof image === 'string') {
    return image;
  }

  if (image instanceof Buffer) {
    return `data:image/png;base64,${image.toString('base64')}`;
  }

  if (image instanceof Uint8Array) {
    return `data:image/png;base64,${Buffer.from(image).toString('base64')}`;
  }

  if ('base64' in image && typeof image.base64 === 'string') {
    return `data:image/png;base64,${image.base64}`;
  }

  if ('url' in image && typeof image.url === 'string') {
    return image.url;
  }

  // GeneratedImage
  if ('mediaType' in image && 'base64' in image) {
    const generated = image as GeneratedImage;
    return `data:${generated.mediaType};base64,${generated.base64}`;
  }

  throw new Error('Invalid image asset format');
}

export async function normalizeVideoAsset(video: VideoAsset): Promise<string> {
  if (typeof video === 'string') {
    return video;
  }

  if (video instanceof Buffer) {
    return `data:video/mp4;base64,${video.toString('base64')}`;
  }

  if (video instanceof Uint8Array) {
    return `data:video/mp4;base64,${Buffer.from(video).toString('base64')}`;
  }

  if ('base64' in video && typeof video.base64 === 'string') {
    return `data:video/mp4;base64,${video.base64}`;
  }

  if ('url' in video && typeof video.url === 'string') {
    return video.url;
  }

  // GeneratedVideo
  if ('mediaType' in video && 'base64' in video) {
    const generated = video as GeneratedVideo;
    return `data:${generated.mediaType};base64,${generated.base64}`;
  }

  throw new Error('Invalid video asset format');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
