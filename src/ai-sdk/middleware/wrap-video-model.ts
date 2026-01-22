import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";
import { generatePlaceholder } from "./placeholder";

export type RenderMode = "strict" | "default" | "preview";

export interface VideoModelMiddleware {
  transformParams?: (options: {
    params: VideoModelV3CallOptions;
    model: VideoModelV3;
  }) => PromiseLike<VideoModelV3CallOptions> | VideoModelV3CallOptions;

  wrapGenerate?: (options: {
    doGenerate: () => PromiseLike<
      Awaited<ReturnType<VideoModelV3["doGenerate"]>>
    >;
    params: VideoModelV3CallOptions;
    model: VideoModelV3;
  }) => PromiseLike<Awaited<ReturnType<VideoModelV3["doGenerate"]>>>;
}

export function wrapVideoModel({
  model,
  middleware,
}: {
  model: VideoModelV3;
  middleware: VideoModelMiddleware;
}): VideoModelV3 {
  const { transformParams, wrapGenerate } = middleware;

  return {
    specificationVersion: "v3",
    provider: model.provider,
    modelId: model.modelId,
    maxVideosPerCall: model.maxVideosPerCall,

    async doGenerate(params: VideoModelV3CallOptions) {
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

export interface PlaceholderFallbackOptions {
  mode: RenderMode;
  onFallback?: (error: Error, prompt: string) => void;
}

export function placeholderFallbackMiddleware(
  options: PlaceholderFallbackOptions,
): VideoModelMiddleware {
  const { mode, onFallback } = options;

  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const createPlaceholderResult = async () => {
        const [width, height] = (params.resolution?.split("x").map(Number) ?? [
          1080, 1920,
        ]) as [number, number];
        const placeholder = await generatePlaceholder({
          type: "video",
          prompt: params.prompt,
          duration: params.duration ?? 3,
          width,
          height,
        });

        return {
          videos: [placeholder.data],
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

export function withPlaceholderFallback(
  model: VideoModelV3,
  options: PlaceholderFallbackOptions,
): VideoModelV3 {
  return wrapVideoModel({
    model,
    middleware: placeholderFallbackMiddleware(options),
  });
}
