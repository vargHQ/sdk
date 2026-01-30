import { File } from "../../ai-sdk/file";
import { generateMusic } from "../../ai-sdk/generate-music";
import type { MusicProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";

export async function renderMusic(
  element: VargElement<"music">,
  ctx: RenderContext,
): Promise<File> {
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
    return result.audio;
  };

  let audio: { uint8Array: Uint8Array; url?: string; mediaType?: string };

  if (ctx.cache) {
    const cached = await ctx.cache.get(cacheKey);
    if (cached) {
      // Handle both old cache format (bare Uint8Array) and new format ({uint8Array, url, mediaType})
      if (cached instanceof Uint8Array) {
        audio = { uint8Array: cached, mediaType: "audio/mpeg" };
      } else {
        const cachedAudio = cached as {
          uint8Array: Uint8Array;
          url?: string;
          mediaType?: string;
        };
        audio = {
          uint8Array: cachedAudio.uint8Array,
          url: cachedAudio.url,
          mediaType: cachedAudio.mediaType,
        };
      }
      if (taskId && ctx.progress) {
        startTask(ctx.progress, taskId);
        completeTask(ctx.progress, taskId);
      }
    } else {
      if (taskId && ctx.progress) startTask(ctx.progress, taskId);
      audio = await generateFn();
      if (taskId && ctx.progress) completeTask(ctx.progress, taskId);
      await ctx.cache.set(cacheKey, {
        uint8Array: audio.uint8Array,
        url: audio.url,
        mediaType: audio.mediaType,
      });
    }
  } else {
    if (taskId && ctx.progress) startTask(ctx.progress, taskId);
    audio = await generateFn();
    if (taskId && ctx.progress) completeTask(ctx.progress, taskId);
  }

  return File.fromGenerated({
    uint8Array: audio.uint8Array,
    mediaType: audio.mediaType ?? "audio/mpeg",
    url: audio.url,
  });
}
