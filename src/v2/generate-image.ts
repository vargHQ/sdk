import type {
  ImageGenerateOptions,
  ImageGenerateResult,
  ImageModel,
} from "./types";

export interface GenerateImageOptions
  extends Omit<ImageGenerateOptions, "abortSignal"> {
  model: ImageModel;
  abortSignal?: AbortSignal;
}

export async function generateImage(
  options: GenerateImageOptions,
): Promise<ImageGenerateResult> {
  const { model, ...rest } = options;
  return model.doGenerate(rest);
}
