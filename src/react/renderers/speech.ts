import type { experimental_generateSpeech } from "ai";
import { File } from "../../ai-sdk/file";
import { ResolvedElement } from "../resolved-element";
import type { SpeechProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { withDedup } from "./dedup";
import { computeCacheKey, getTextContent } from "./utils";

export async function renderSpeech(
  element: VargElement<"speech">,
  ctx: RenderContext,
): Promise<File> {
  if (element instanceof ResolvedElement) {
    ctx.generatedFiles.push(element.meta.file);
    return element.meta.file;
  }

  const props = element.props as SpeechProps;
  const text = getTextContent(element.children);

  if (!text) {
    throw new Error("Speech element requires text content");
  }

  const model = props.model ?? ctx.defaults?.speech;
  if (!model) {
    throw new Error("Speech requires 'model' prop (or set defaults.speech)");
  }

  const modelId = typeof model === "string" ? model : model.modelId;
  const cacheKey = computeCacheKey(element);

  return withDedup(element, ctx, "speech", modelId, async () => {
    const { audio } = await ctx.generateSpeech({
      model,
      text,
      voice: props.voice ?? "rachel",
      cacheKey,
    } as Parameters<typeof experimental_generateSpeech>[0]);

    if (!audio?.uint8Array) {
      throw new Error(
        `We couldn't generate the voiceover for this scene (speech model "${modelId}"). ` +
          `The audio came back empty. Please try again — if it keeps happening, ` +
          `try a different voice or speech model.`,
      );
    }

    const mediaType =
      (audio as { mediaType?: string }).mediaType ?? "audio/mpeg";

    const file = File.fromGenerated({
      uint8Array: audio.uint8Array,
      mediaType,
      url: (audio as { url?: string }).url,
    }).withMetadata({
      type: "speech",
      model: modelId,
      prompt: text,
    });

    return file;
  });
}
