import type {
  TranscribeOptions,
  TranscribeResult,
  TranscriptionModel,
} from "./types";

export interface TranscribeOpts extends Omit<TranscribeOptions, "abortSignal"> {
  model: TranscriptionModel;
  abortSignal?: AbortSignal;
}

export async function transcribe(
  options: TranscribeOpts,
): Promise<TranscribeResult> {
  const { model, ...rest } = options;
  return model.doTranscribe(rest);
}
