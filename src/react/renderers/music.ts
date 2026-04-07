import { File } from "../../ai-sdk/file";
import type { generateMusic } from "../../ai-sdk/generate-music";
import { ResolvedElement } from "../resolved-element";
import type { MusicProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";
import { computeCacheKey } from "./utils";

export async function renderMusic(
  element: VargElement<"music">,
  ctx: RenderContext,
): Promise<File> {
  // If already resolved via `await Music(...)`, reuse the pre-generated file
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

  const cacheKey = computeCacheKey(element);
  const cacheKeyStr = JSON.stringify(cacheKey);

  // Deduplicate concurrent renders of the same music element
  const pendingRender = ctx.pendingFiles.get(cacheKeyStr);
  if (pendingRender) {
    return pendingRender;
  }

  const renderPromise = (async () => {
    const modelId = model.modelId ?? "music";
    const taskId = ctx.progress
      ? addTask(ctx.progress, "music", modelId)
      : null;
    if (taskId && ctx.progress) startTask(ctx.progress, taskId);

    const { audio } = await ctx.generateMusic({
      model,
      prompt,
      duration: props.duration,
      cacheKey,
    } as Parameters<typeof generateMusic>[0]);

    if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

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

    ctx.generatedFiles.push(file);

    return file;
  })();

  ctx.pendingFiles.set(cacheKeyStr, renderPromise);

  return renderPromise;
}
