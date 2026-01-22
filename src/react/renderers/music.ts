import { generateMusic } from "../../ai-sdk/generate-music";
import type { MusicProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";

export async function renderMusic(
  element: VargElement<"music">,
  ctx: RenderContext,
): Promise<{ path: string }> {
  const props = element.props as MusicProps;

  const prompt = props.prompt;
  const model = props.model ?? ctx.defaults?.music;
  if (!prompt || !model) {
    throw new Error("Music requires prompt and model (or set defaults.music)");
  }

  const cacheKey = JSON.stringify({
    type: "music",
    prompt,
    model: model.modelId,
    duration: props.duration,
  });

  const modelId = model.modelId ?? "music";
  const taskId = ctx.progress ? addTask(ctx.progress, "music", modelId) : null;

  const generateFn = async () => {
    const result = await generateMusic({
      model,
      prompt,
      duration: props.duration,
    });
    return result.audio.uint8Array;
  };

  let audioData: Uint8Array;

  if (ctx.cache) {
    const cached = await ctx.cache.get(cacheKey);
    if (cached) {
      audioData = cached as Uint8Array;
    } else {
      if (taskId && ctx.progress) startTask(ctx.progress, taskId);
      audioData = await generateFn();
      if (taskId && ctx.progress) completeTask(ctx.progress, taskId);
      await ctx.cache.set(cacheKey, audioData);
    }
  } else {
    if (taskId && ctx.progress) startTask(ctx.progress, taskId);
    audioData = await generateFn();
    if (taskId && ctx.progress) completeTask(ctx.progress, taskId);
  }

  const tempPath = `/tmp/varg-music-${Date.now()}.mp3`;
  await Bun.write(tempPath, audioData);
  ctx.tempFiles.push(tempPath);

  return { path: tempPath };
}
