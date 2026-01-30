import { experimental_generateSpeech as generateSpeech } from "ai";
import { File } from "../../ai-sdk/file";
import type { SpeechProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";
import { computeCacheKey, getTextContent } from "./utils";

export async function renderSpeech(
  element: VargElement<"speech">,
  ctx: RenderContext,
): Promise<File> {
  const props = element.props as SpeechProps;
  const text = getTextContent(element.children);

  if (!text) {
    throw new Error("Speech element requires text content");
  }

  const model = props.model ?? ctx.defaults?.speech;
  if (!model) {
    throw new Error("Speech requires 'model' prop (or set defaults.speech)");
  }

  const cacheKey = computeCacheKey(element);

  const modelId = typeof model === "string" ? model : model.modelId;
  const taskId = ctx.progress ? addTask(ctx.progress, "speech", modelId) : null;
  if (taskId && ctx.progress) startTask(ctx.progress, taskId);

  const { audio } = await generateSpeech({
    model,
    text,
    voice: props.voice ?? "adam",
    cacheKey,
  } as Parameters<typeof generateSpeech>[0]);

  if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

  return File.fromGenerated({
    uint8Array: audio.uint8Array,
    mediaType: "audio/mpeg",
    url: (audio as { url?: string }).url,
  });
}
