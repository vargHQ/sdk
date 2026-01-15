import { experimental_generateSpeech as generateSpeech } from "ai";
import { File } from "../../file";
import type { SpeechProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { computeCacheKey, getTextContent } from "./utils";

export interface SpeechResult {
  path: string;
  duration?: number;
}

export async function renderSpeech(
  element: VargElement<"speech">,
  ctx: RenderContext,
): Promise<SpeechResult> {
  const props = element.props as SpeechProps;
  const text = getTextContent(element.children);

  if (!text) {
    throw new Error("Speech element requires text content");
  }

  const model = props.model;
  if (!model) {
    throw new Error("Speech element requires 'model' prop");
  }

  const cacheKey = computeCacheKey(element);

  const { audio } = await generateSpeech({
    model,
    text,
    voice: props.voice ?? "adam",
    cacheKey,
  } as Parameters<typeof generateSpeech>[0]);

  const tempPath = await File.toTemp({
    uint8Array: audio.uint8Array,
    mimeType: "audio/mpeg",
  });
  ctx.tempFiles.push(tempPath);

  return {
    path: tempPath,
  };
}
