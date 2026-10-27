import { File } from "../../ai-sdk/file";
import type { generateMusic } from "../../ai-sdk/generate-music";
import { ResolvedElement } from "../resolved-element";
import type { MusicProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { withDedup } from "./dedup";
import { computeCacheKey } from "./utils";

export async function renderMusic(
  element: VargElement<"music">,
  ctx: RenderContext,
): Promise<File> {
  if (element instanceof ResolvedElement) {
    ctx.generatedFiles.push(element.meta.file);
    return element.meta.file;
  }

  const props = element.props as MusicProps;

  const prompt = props.prompt;
  const model = props.model ?? ctx.defaults?.music;
  if (!prompt || !model) {
    throw new Error("Music requires prompt and model (or set defaults.music)");
  }

  const modelId = model.modelId ?? "music";
  const cacheKey = computeCacheKey(element);

  return withDedup(element, ctx, "music", modelId, async () => {
    const { audio } = await ctx.generateMusic({
      model,
      prompt,
      duration: props.duration,
      cacheKey,
    } as Parameters<typeof generateMusic>[0]);

    if (!audio?.uint8Array) {
      throw new Error(
        `We couldn't generate the background music for this video (music model "${modelId}"). ` +
          `The audio came back empty. Please try again — if it keeps happening, ` +
          `try a different music model or adjust the prompt.`,
      );
    }

    const mediaType =
      (audio as { mediaType?: string }).mediaType ?? "audio/mpeg";

    const file = File.fromGenerated({
      uint8Array: audio.uint8Array,
      mediaType,
      url: (audio as { url?: string }).url,
    }).withMetadata({
      type: "music",
      model: modelId,
      prompt,
    });

    return file;
  });
}
