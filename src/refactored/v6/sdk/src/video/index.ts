// packages/sdk/src/video/index.ts

import type {
  GenerateVideoParams,
  AnimateImageParams,
  TransformVideoParams,
  VideoGenerateResult,
  ImageAsset,
  VideoAsset,
} from '../types';
import { createGeneratedFile } from '../providers';

export async function generateVideo(
  params: GenerateVideoParams
): Promise<VideoGenerateResult> {
  const { model, ...rest } = params;

  const result = await model.doGenerate({
    prompt: rest.prompt,
    negative_prompt: rest.negativePrompt,
    aspect_ratio: rest.aspectRatio,
    duration: rest.duration,
    fps: rest.fps,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const videos = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: videos,
    videos,
    video: videos[0],
  };
}

export async function animateImage(
  params: AnimateImageParams
): Promise<VideoGenerateResult> {
  const { model, image, ...rest } = params;

  const normalizedImage = await normalizeImageAsset(image);

  const result = await model.doGenerate({
    image: normalizedImage,
    prompt: rest.prompt,
    negative_prompt: rest.negativePrompt,
    aspect_ratio: rest.aspectRatio,
    duration: rest.duration,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const videos = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: videos,
    videos,
    video: videos[0],
  };
}

export async function transformVideo(
  params: TransformVideoParams
): Promise<VideoGenerateResult> {
  const { model, video, ...rest } = params;

  const normalizedVideo = await normalizeVideoAsset(video);

  const result = await model.doGenerate({
    video: normalizedVideo,
    prompt: rest.prompt,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const videos = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: videos,
    videos,
    video: videos[0],
  };
}

async function normalizeImageAsset(image: ImageAsset): Promise<string> {
  if (typeof image === 'string') return image;
  if (image instanceof Buffer)
    return `data:image/png;base64,${image.toString('base64')}`;
  if (image instanceof Uint8Array)
    return `data:image/png;base64,${Buffer.from(image).toString('base64')}`;
  if ('base64' in image) return `data:image/png;base64,${image.base64}`;
  if ('url' in image) return image.url;
  if ('toDataURL' in image) return image.toDataURL();
  throw new Error('Invalid image asset');
}

async function normalizeVideoAsset(video: VideoAsset): Promise<string> {
  if (typeof video === 'string') return video;
  if (video instanceof Buffer)
    return `data:video/mp4;base64,${video.toString('base64')}`;
  if (video instanceof Uint8Array)
    return `data:video/mp4;base64,${Buffer.from(video).toString('base64')}`;
  if ('base64' in video) return `data:video/mp4;base64,${video.base64}`;
  if ('url' in video) return video.url;
  if ('toDataURL' in video) return video.toDataURL();
  throw new Error('Invalid video asset');
}
