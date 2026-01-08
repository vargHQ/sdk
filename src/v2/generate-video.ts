import type {
  VideoGenerateOptions,
  VideoGenerateResult,
  VideoModel,
} from "./types";

export interface GenerateVideoOptions
  extends Omit<VideoGenerateOptions, "abortSignal"> {
  model: VideoModel;
  abortSignal?: AbortSignal;
}

export async function generateVideo(
  options: GenerateVideoOptions,
): Promise<VideoGenerateResult> {
  const { model, ...rest } = options;
  return model.doGenerate(rest);
}
