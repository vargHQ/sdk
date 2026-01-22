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
  const { mode } = options;

  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      if (mode === "preview") {
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
              message: "placeholder: preview mode",
            },
          ],
          response: {
            timestamp: new Date(),
            modelId: model.modelId,
            headers: undefined,
          },
        };
      }

      return doGenerate();
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
