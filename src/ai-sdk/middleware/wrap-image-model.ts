import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  ImageModelV3Middleware,
} from "@ai-sdk/provider";
import { wrapImageModel } from "ai";
import { generatePlaceholder } from "./placeholder";
import type { RenderMode } from "./wrap-video-model";

export interface ImagePlaceholderFallbackOptions {
  mode: RenderMode;
  onFallback?: (error: Error, prompt: string) => void;
}

export function imagePlaceholderFallbackMiddleware(
  options: ImagePlaceholderFallbackOptions,
): ImageModelV3Middleware {
  const { mode, onFallback } = options;

  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const createPlaceholderResult = async () => {
        const [width, height] = (params.size?.split("x").map(Number) ?? [
          1024, 1024,
        ]) as [number, number];
        const prompt =
          typeof params.prompt === "string"
            ? params.prompt
            : ((params.prompt as { text?: string } | undefined)?.text ??
              "placeholder");

        const placeholder = await generatePlaceholder({
          type: "image",
          prompt,
          width,
          height,
        });

        return {
          images: [placeholder.data],
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
        const promptText =
          typeof params.prompt === "string"
            ? params.prompt
            : ((params.prompt as { text?: string } | undefined)?.text ??
              "placeholder");
        onFallback?.(error, promptText);
        return createPlaceholderResult();
      }
    },
  };
}

export function withImagePlaceholderFallback(
  model: ImageModelV3,
  options: ImagePlaceholderFallbackOptions,
): ImageModelV3 {
  return wrapImageModel({
    model,
    middleware: imagePlaceholderFallbackMiddleware(options),
  });
}
