// packages/sdk/src/image/index.ts

import type {
  GenerateImageParams,
  TransformImageParams,
  UpscaleImageParams,
  ImageGenerateResult,
  ImageAsset,
} from '../types';
import { createGeneratedFile } from '../providers';

export async function generateImage(
  params: GenerateImageParams
): Promise<ImageGenerateResult> {
  const { model, ...rest } = params;

  const result = await model.doGenerate({
    prompt: rest.prompt,
    negative_prompt: rest.negativePrompt,
    num_images: rest.n ?? 1,
    aspect_ratio: rest.aspectRatio,
    image_size: rest.size,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const images = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: images,
    images,
    image: images[0],
  };
}

export async function transformImage(
  params: TransformImageParams
): Promise<ImageGenerateResult> {
  const { model, image, ...rest } = params;

  const normalizedImage = await normalizeImageAsset(image);

  const result = await model.doGenerate({
    image: normalizedImage,
    prompt: rest.prompt,
    strength: rest.strength,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const images = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: images,
    images,
    image: images[0],
  };
}

export async function upscaleImage(
  params: UpscaleImageParams
): Promise<ImageGenerateResult> {
  const { model, image, ...rest } = params;

  const normalizedImage = await normalizeImageAsset(image);

  const result = await model.doGenerate({
    image: normalizedImage,
    scale: rest.scale ?? 2,
    seed: rest.seed,
    ...rest.providerOptions,
  });

  const images = result.files.map((f) => createGeneratedFile(f));

  return {
    ...result,
    files: images,
    images,
    image: images[0],
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
