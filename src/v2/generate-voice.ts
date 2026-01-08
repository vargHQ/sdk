import type { TTSGenerateOptions, TTSGenerateResult, TTSModel } from "./types";

export interface GenerateVoiceOptions
  extends Omit<TTSGenerateOptions, "abortSignal"> {
  model: TTSModel;
  abortSignal?: AbortSignal;
}

export async function generateVoice(
  options: GenerateVoiceOptions,
): Promise<TTSGenerateResult> {
  const { model, ...rest } = options;
  return model.doGenerate(rest);
}
