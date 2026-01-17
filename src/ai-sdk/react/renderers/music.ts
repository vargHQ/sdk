import { generateMusic } from "../../generate-music";
import type { MusicProps, VargElement } from "../types";
import type { RenderContext } from "./context";

export async function renderMusic(
  element: VargElement<"music">,
  ctx: RenderContext,
): Promise<{ path: string }> {
  const props = element.props as MusicProps;

  if (!props.prompt || !props.model) {
    throw new Error("Music generation requires both prompt and model");
  }

  const cacheKey = JSON.stringify({
    type: "music",
    prompt: props.prompt,
    model: props.model.modelId,
    duration: props.duration,
  });

  const generateFn = async () => {
    const result = await generateMusic({
      model: props.model!,
      prompt: props.prompt!,
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
      audioData = await generateFn();
      await ctx.cache.set(cacheKey, audioData);
    }
  } else {
    audioData = await generateFn();
  }

  const tempPath = `/tmp/varg-music-${Date.now()}.mp3`;
  await Bun.write(tempPath, audioData);
  ctx.tempFiles.push(tempPath);

  return { path: tempPath };
}
