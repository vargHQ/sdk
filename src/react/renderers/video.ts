import { File } from "../../ai-sdk/file";
import type { generateVideo } from "../../ai-sdk/generate-video";
import { ResolvedElement } from "../resolved-element";
import type { VargElement, VideoPrompt, VideoProps } from "../types";
import type { RenderContext } from "./context";
import { withDedup } from "./dedup";
import {
  resolveAudioInput,
  resolveImageInput,
  resolveVideoInput,
} from "./inputs";
import { computeCacheKey } from "./utils";

async function resolvePrompt(
  prompt: VideoPrompt,
  ctx: RenderContext,
): Promise<
  | string
  | {
      text?: string;
      images?: Uint8Array[];
      audio?: Uint8Array;
      video?: Uint8Array;
    }
> {
  if (typeof prompt === "string") {
    return prompt;
  }
  const [resolvedImages, resolvedAudio, resolvedVideo] = await Promise.all([
    prompt.images
      ? Promise.all(prompt.images.map((img) => resolveImageInput(img, ctx)))
      : undefined,
    resolveAudioInput(prompt.audio, ctx),
    resolveVideoInput(prompt.video, ctx),
  ]);
  return {
    text: prompt.text,
    images: resolvedImages,
    audio: resolvedAudio,
    video: resolvedVideo,
  };
}

export async function renderVideo(
  element: VargElement<"video">,
  ctx: RenderContext,
): Promise<File> {
  // If already resolved via `await Video(...)`, reuse the pre-generated file
  if (element instanceof ResolvedElement) {
    ctx.generatedFiles.push(element.meta.file);
    return element.meta.file;
  }

  const props = element.props as VideoProps;

  if (props.src && !props.prompt) {
    const file =
      typeof props.src === "string" && props.src.startsWith("http")
        ? File.fromUrl(props.src)
        : File.fromPath(props.src);

    // When cutFrom/cutTo are set on a src-only Video, trim the video via
    // local ffmpeg before returning. This pre-trims prompt.video inputs for
    // models with input length limits (e.g. motion-control max 30s).
    if (props.cutFrom !== undefined || props.cutTo !== undefined) {
      const input = file.url ?? (await file.toTempFile());
      const start = props.cutFrom ?? 0;
      const duration = (props.cutTo ?? start + 30) - start;
      const tmpDir = process.env.TMPDIR ?? "/tmp";
      const outPath = `${tmpDir}/varg-trim-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

      const { $ } = await import("bun");
      await $`ffmpeg -y -ss ${start} -i ${input} -t ${duration} -c copy -movflags +faststart ${outPath}`.quiet();

      const data = await Bun.file(outPath).arrayBuffer();
      await Bun.file(outPath).delete?.();
      return File.fromBuffer(new Uint8Array(data), "video/mp4");
    }

    return file;
  }

  const prompt = props.prompt;
  if (!prompt) {
    throw new Error("Video element requires either 'prompt' or 'src'");
  }

  const model = props.model ?? ctx.defaults?.video;
  if (!model) {
    throw new Error(
      "Video element requires 'model' prop (or set defaults.video in render options)",
    );
  }

  const modelId = typeof model === "string" ? model : model.modelId;
  const cacheKey = computeCacheKey(element);

  return withDedup(element, ctx, "video", modelId, async () => {
    const resolvedPrompt = await resolvePrompt(prompt, ctx);

    const { video } = await ctx.generateVideo({
      model,
      prompt: resolvedPrompt,
      duration: props.duration ?? 5,
      aspectRatio: props.aspectRatio,
      providerOptions: props.providerOptions,
      cacheKey,
    } as Parameters<typeof generateVideo>[0]);

    const mediaType = video.mimeType ?? "video/mp4";
    const promptText =
      typeof resolvedPrompt === "string" ? resolvedPrompt : resolvedPrompt.text;

    const file = File.fromGenerated({
      uint8Array: video.uint8Array,
      mediaType,
      url: (video as { url?: string }).url,
    }).withMetadata({
      type: "video",
      model: modelId,
      prompt: promptText,
      duration: props.duration,
    });

    if (!file.url && ctx.storage) {
      await file.upload(ctx.storage);
    }

    return file;
  });
}
