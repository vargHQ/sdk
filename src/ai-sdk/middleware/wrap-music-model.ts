import type { MusicModelV3, MusicModelV3CallOptions } from "../music-model";
import { generatePlaceholder } from "./placeholder";
import type { RenderMode } from "./wrap-video-model";

export interface MusicModelMiddleware {
  transformParams?: (options: {
    params: MusicModelV3CallOptions;
    model: MusicModelV3;
  }) => PromiseLike<MusicModelV3CallOptions> | MusicModelV3CallOptions;

  wrapGenerate?: (options: {
    doGenerate: () => PromiseLike<
      Awaited<ReturnType<MusicModelV3["doGenerate"]>>
    >;
    params: MusicModelV3CallOptions;
    model: MusicModelV3;
  }) => PromiseLike<Awaited<ReturnType<MusicModelV3["doGenerate"]>>>;
}

export function wrapMusicModel({
  model,
  middleware,
}: {
  model: MusicModelV3;
  middleware: MusicModelMiddleware;
}): MusicModelV3 {
  const { transformParams, wrapGenerate } = middleware;

  return {
    specificationVersion: "v3",
    provider: model.provider,
    modelId: model.modelId,

    async doGenerate(params: MusicModelV3CallOptions) {
      const transformedParams = transformParams
        ? await transformParams({ params, model })
        : params;

      const doGenerate = () => model.doGenerate(transformedParams);

      return wrapGenerate
        ? wrapGenerate({ doGenerate, params: transformedParams, model })
        : doGenerate();
    },
  };
}

export interface MusicPlaceholderFallbackOptions {
  mode: RenderMode;
  onFallback?: (error: Error, prompt: string) => void;
}

export function musicPlaceholderFallbackMiddleware(
  options: MusicPlaceholderFallbackOptions,
): MusicModelMiddleware {
  const { mode, onFallback } = options;

  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const createPlaceholderResult = async () => {
        const placeholder = await generatePlaceholder({
          type: "audio",
          prompt: params.prompt,
          duration: params.duration ?? 10,
        });

        return {
          audio: placeholder.data,
          warnings: [
            {
              type: "other" as const,
              message: "placeholder: provider skipped or failed",
            },
          ],
          response: {
            timestamp: new Date(),
            modelId: model.modelId,
            headers: undefined,
          },
        };
      };

      if (mode === "preview") {
        return createPlaceholderResult();
      }

      try {
        return await doGenerate();
      } catch (e) {
        if (mode === "strict") throw e;

        const error = e instanceof Error ? e : new Error(String(e));
        onFallback?.(error, params.prompt);
        return createPlaceholderResult();
      }
    },
  };
}

export function withMusicPlaceholderFallback(
  model: MusicModelV3,
  options: MusicPlaceholderFallbackOptions,
): MusicModelV3 {
  return wrapMusicModel({
    model,
    middleware: musicPlaceholderFallbackMiddleware(options),
  });
}
