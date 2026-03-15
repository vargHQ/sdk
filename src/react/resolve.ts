/**
 * Standalone resolve functions for generating media assets outside of render().
 *
 * These are called when the user writes `await Speech({...})`, `await Image({...})`, etc.
 * They generate the asset, probe metadata (duration for audio/video), and return
 * a ResolvedElement that carries the result in its `meta` field.
 */

import {
  generateImage,
  experimental_generateSpeech as generateSpeechAI,
} from "ai";
import { $ } from "bun";
import { withCache } from "../ai-sdk/cache";
import { File } from "../ai-sdk/file";
import { fileCache } from "../ai-sdk/file-cache";
import { generateMusic } from "../ai-sdk/generate-music";
import { generateVideo as generateVideoRaw } from "../ai-sdk/generate-video";
import { computeCacheKey, getTextContent } from "./renderers/utils";
import { ResolvedElement } from "./resolved-element";
import type {
  ImagePrompt,
  ImageProps,
  MusicProps,
  SpeechProps,
  VargElement,
} from "./types";

// ---------------------------------------------------------------------------
// Cache — use the same .cache/ai directory as the render pipeline
// ---------------------------------------------------------------------------
const DEFAULT_CACHE_DIR = ".cache/ai";

let _cache: ReturnType<typeof fileCache> | undefined;
function getCache() {
  if (!_cache) {
    _cache = fileCache({ dir: DEFAULT_CACHE_DIR });
  }
  return _cache;
}

/** Cached video generation (same pattern as render pipeline) */
const generateVideo = withCache(generateVideoRaw, {
  storage: getCache(),
});

// ---------------------------------------------------------------------------
// Duration probing via ffprobe
// ---------------------------------------------------------------------------
async function probeAudioDuration(file: File): Promise<number> {
  const tmpPath = await file.toTempFile();
  try {
    const result =
      await $`ffprobe -v error -show_entries format=duration -of json ${tmpPath}`.json();
    const duration = parseFloat(result?.format?.duration ?? "0");
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Speech
// ---------------------------------------------------------------------------
export async function resolveSpeechElement(
  element: VargElement<"speech">,
  props: SpeechProps,
): Promise<ResolvedElement<"speech">> {
  const text = getTextContent(element.children);
  if (!text) {
    throw new Error(
      "Speech element requires text content (pass as children prop)",
    );
  }

  const model = props.model;
  if (!model) {
    throw new Error(
      "await Speech() requires 'model' prop (e.g., elevenlabs.speechModel('eleven_turbo_v2'))",
    );
  }

  const cacheKey = computeCacheKey(element);

  const { audio } = await generateSpeechAI({
    model,
    text,
    voice: props.voice ?? "rachel",
    cacheKey,
  } as Parameters<typeof generateSpeechAI>[0]);

  const mediaType = (audio as { mediaType?: string }).mediaType ?? "audio/mpeg";

  const file = File.fromGenerated({
    uint8Array: audio.uint8Array,
    mediaType,
    url: (audio as { url?: string }).url,
  }).withMetadata({
    type: "speech",
    model: typeof model === "string" ? model : model.modelId,
    prompt: text,
  });

  const duration = await probeAudioDuration(file);

  return new ResolvedElement(element, {
    file,
    duration,
  });
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

async function resolveImageInputForStandalone(
  input: unknown,
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (typeof input === "string") {
    if (
      input.startsWith("http://") ||
      input.startsWith("https://") ||
      input.startsWith("file://")
    ) {
      const response = await fetch(input);
      return new Uint8Array(await response.arrayBuffer());
    }
    const response = await fetch(`file://${input}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  // Nested VargElement<"image"> — resolve it recursively
  if (
    input &&
    typeof input === "object" &&
    "type" in input &&
    (input as VargElement).type === "image"
  ) {
    const nested = input as VargElement<"image">;
    const resolved = await resolveImageElement(
      nested,
      nested.props as ImageProps,
    );
    return resolved.file.arrayBuffer();
  }
  throw new Error(`Unsupported image input type: ${typeof input}`);
}

async function resolveImagePrompt(
  prompt: ImagePrompt,
): Promise<string | { text?: string; images: Uint8Array[] }> {
  if (typeof prompt === "string") return prompt;
  const resolvedImages = await Promise.all(
    prompt.images.map((img) => resolveImageInputForStandalone(img)),
  );
  return { text: prompt.text, images: resolvedImages };
}

export async function resolveImageElement(
  element: VargElement<"image">,
  props: ImageProps,
): Promise<ResolvedElement<"image">> {
  if (props.src) {
    const file =
      typeof props.src === "string" && props.src.startsWith("http")
        ? File.fromUrl(props.src)
        : File.fromPath(props.src);

    return new ResolvedElement(element, {
      file,
      duration: 0,
      aspectRatio: props.aspectRatio,
    });
  }

  const prompt = props.prompt;
  if (!prompt) {
    throw new Error("Image element requires either 'prompt' or 'src'");
  }

  const model = props.model;
  if (!model) {
    throw new Error(
      "await Image() requires 'model' prop (e.g., fal.imageModel('nano-banana-pro'))",
    );
  }

  const cacheKey = computeCacheKey(element);
  const resolvedPrompt = await resolveImagePrompt(prompt);

  const { images } = await generateImage({
    model,
    prompt: resolvedPrompt,
    aspectRatio: props.aspectRatio,
    providerOptions: props.providerOptions,
    n: 1,
    cacheKey,
  } as Parameters<typeof generateImage>[0]);

  const firstImage = images[0];
  if (!firstImage?.uint8Array) {
    throw new Error("Image generation returned no image data");
  }

  const promptText =
    typeof resolvedPrompt === "string" ? resolvedPrompt : resolvedPrompt.text;
  const modelId = typeof model === "string" ? model : model.modelId;

  const file = File.fromGenerated({
    uint8Array: firstImage.uint8Array,
    mediaType: "image/png",
    url: (firstImage as { url?: string }).url,
  }).withMetadata({
    type: "image",
    model: modelId,
    prompt: promptText,
  });

  return new ResolvedElement(element, {
    file,
    duration: 0,
    aspectRatio: props.aspectRatio,
  });
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------
export async function resolveVideoElement(
  element: VargElement<"video">,
  props: Record<string, unknown>,
): Promise<ResolvedElement<"video">> {
  if (props.src && !props.prompt) {
    const src = props.src as string;
    const file = src.startsWith("http")
      ? File.fromUrl(src)
      : File.fromPath(src);
    return new ResolvedElement(element, {
      file,
      duration: 0, // video duration probing deferred to a later phase
    });
  }

  const prompt = props.prompt;
  if (!prompt) {
    throw new Error("Video element requires either 'prompt' or 'src'");
  }

  const model = props.model;
  if (!model) {
    throw new Error(
      "await Video() requires 'model' prop (e.g., fal.videoModel('kling-v3'))",
    );
  }

  const cacheKey = computeCacheKey(element);

  // Resolve prompt inputs (images, audio, video references)
  let resolvedPrompt: Parameters<typeof generateVideoRaw>[0]["prompt"];
  if (typeof prompt === "string") {
    resolvedPrompt = prompt;
  } else {
    const promptObj = prompt as {
      text?: string;
      images?: unknown[];
      audio?: unknown;
      video?: unknown;
    };

    const resolvedImages = promptObj.images
      ? await Promise.all(
          promptObj.images.map(async (img) => {
            if (img instanceof Uint8Array) return img;
            if (typeof img === "string") {
              const res = await fetch(img);
              return new Uint8Array(await res.arrayBuffer());
            }
            // VargElement<"image"> — could be resolved or unresolved
            if (
              img &&
              typeof img === "object" &&
              "type" in img &&
              (img as VargElement).type === "image"
            ) {
              const imgEl = img as VargElement<"image">;
              if (imgEl.meta?.file) {
                return imgEl.meta.file.arrayBuffer();
              }
              const resolved = await resolveImageElement(
                imgEl,
                imgEl.props as ImageProps,
              );
              return resolved.file.arrayBuffer();
            }
            throw new Error(`Unsupported image input in Video prompt`);
          }),
        )
      : undefined;

    let resolvedAudio: Uint8Array | undefined;
    if (promptObj.audio) {
      if (promptObj.audio instanceof Uint8Array) {
        resolvedAudio = promptObj.audio;
      } else if (typeof promptObj.audio === "string") {
        const res = await fetch(promptObj.audio);
        resolvedAudio = new Uint8Array(await res.arrayBuffer());
      } else if (
        promptObj.audio &&
        typeof promptObj.audio === "object" &&
        "type" in promptObj.audio
      ) {
        const audioEl = promptObj.audio as VargElement<"speech">;
        if (audioEl.meta?.file) {
          resolvedAudio = await audioEl.meta.file.arrayBuffer();
        } else {
          const resolved = await resolveSpeechElement(
            audioEl,
            audioEl.props as SpeechProps,
          );
          resolvedAudio = await resolved.file.arrayBuffer();
        }
      }
    }

    resolvedPrompt = {
      text: promptObj.text,
      images: resolvedImages,
      audio: resolvedAudio,
      video: undefined, // video-to-video not supported in standalone yet
    };
  }

  const { video } = await generateVideo({
    model: model as Parameters<typeof generateVideoRaw>[0]["model"],
    prompt: resolvedPrompt,
    duration: (props.duration as number) ?? 5,
    aspectRatio: props.aspectRatio as `${number}:${number}` | undefined,
    providerOptions: props.providerOptions as Parameters<
      typeof generateVideoRaw
    >[0]["providerOptions"],
    cacheKey,
  });

  const mediaType = video.mimeType ?? "video/mp4";
  const promptText =
    typeof resolvedPrompt === "string" ? resolvedPrompt : resolvedPrompt?.text;
  const modelId =
    typeof model === "string" ? model : (model as { modelId: string }).modelId;

  const file = File.fromGenerated({
    uint8Array: video.uint8Array,
    mediaType,
    url: (video as { url?: string }).url,
  }).withMetadata({
    type: "video",
    model: modelId,
    prompt: promptText,
  });

  return new ResolvedElement(element, {
    file,
    duration: 0, // video duration probing deferred to a later phase
  });
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------
export async function resolveMusicElement(
  element: VargElement<"music">,
  props: MusicProps,
): Promise<ResolvedElement<"music">> {
  const prompt = props.prompt;
  const model = props.model;

  if (!prompt || !model) {
    throw new Error("await Music() requires 'prompt' and 'model' props");
  }

  const { audio } = await generateMusic({
    model,
    prompt,
    duration: props.duration,
  });

  const file = File.fromGenerated({
    uint8Array: audio.uint8Array,
    mediaType: "audio/mpeg",
  }).withMetadata({
    type: "music",
    model: typeof model === "string" ? model : model.modelId,
    prompt,
  });

  const duration = await probeAudioDuration(file);

  return new ResolvedElement(element, {
    file,
    duration,
  });
}
