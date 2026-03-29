/**
 * Standalone resolve functions for generating media assets outside of render().
 *
 * These are called when the user writes `await Speech({...})`, `await Image({...})`, etc.
 * They generate the asset, probe metadata (duration for audio/video), and return
 * a ResolvedElement that carries the result in its `meta` field.
 *
 * When running inside render() (via async components), the ResolveContext from
 * AsyncLocalStorage provides the backend, cache, and storage — enabling cloud
 * rendering. When running at top level (outside render()), local defaults are used.
 */

import {
  generateImage,
  experimental_generateSpeech as generateSpeechAI,
} from "ai";
import { $ } from "bun";
import { type CacheStorage, withCache } from "../ai-sdk/cache";
import { File } from "../ai-sdk/file";
import { fileCache } from "../ai-sdk/file-cache";
import { generateMusic as generateMusicRaw } from "../ai-sdk/generate-music";
import { generateVideo as generateVideoRaw } from "../ai-sdk/generate-video";
import type { FFmpegBackend } from "../ai-sdk/providers/editly/backends";
import { mapWordsToSegments } from "../speech/map-segments";
import { parseElevenLabsAlignment } from "../speech/parse-alignment";
import type {
  ElevenLabsCharacterAlignment,
  Segment,
  SegmentDescriptor,
  WordTiming,
} from "../speech/types";
import { computeCacheKey, getTextContent } from "./renderers/utils";
import { getResolveContext } from "./resolve-context";
import { ResolvedElement } from "./resolved-element";
import type {
  ImagePrompt,
  ImageProps,
  MusicProps,
  SpeechProps,
  VargElement,
} from "./types";

// ---------------------------------------------------------------------------
// Local fallback cache (used only when no ResolveContext is available)
// ---------------------------------------------------------------------------
const DEFAULT_CACHE_DIR = ".cache/ai";

let _localCache: ReturnType<typeof fileCache> | undefined;
/** Get the local file cache (fallback for top-level await without render context). */
function getLocalCache(): CacheStorage {
  if (!_localCache) {
    _localCache = fileCache({ dir: DEFAULT_CACHE_DIR });
  }
  return _localCache;
}

/** Get the active cache storage — from context if available, otherwise local fallback. */
function getActiveCache(): CacheStorage {
  return getResolveContext()?.cache ?? getLocalCache();
}

// ---------------------------------------------------------------------------
// Duration probing — uses backend.ffprobe() when available, local ffprobe otherwise
// ---------------------------------------------------------------------------
/** Probe an audio/video file's duration in seconds. Uses backend.ffprobe() when available. */
async function probeDuration(file: File): Promise<number> {
  const ctx = getResolveContext();
  if (ctx?.backend) {
    return probeDurationViaBackend(file, ctx.backend);
  }
  return probeDurationLocal(file);
}

/** Probe duration via the FFmpeg backend (works with both local and cloud backends). */
async function probeDurationViaBackend(
  file: File,
  backend: FFmpegBackend,
): Promise<number> {
  try {
    const path = await backend.resolvePath(file);
    const info = await backend.ffprobe(path);
    return info.duration ?? 0;
  } catch {
    return 0;
  }
}

/** Probe duration via local ffprobe shell command (fallback for top-level await). */
async function probeDurationLocal(file: File): Promise<number> {
  try {
    const tmpPath = await file.toTempFile();
    const result =
      await $`ffprobe -v error -show_entries format=duration -of json ${tmpPath}`.json();
    const duration = Number.parseFloat(result?.format?.duration ?? "0");
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Cached video generation — uses context cache when available
// ---------------------------------------------------------------------------
/** Get a cached generateVideo wrapper using the active cache storage. */
function getCachedGenerateVideo() {
  const ctx = getResolveContext();
  const storage = ctx?.cache ?? getLocalCache();
  return withCache(generateVideoRaw, { storage });
}

/** Get a cached generateMusic wrapper using the active cache storage. */
function getCachedGenerateMusic() {
  const ctx = getResolveContext();
  const storage = ctx?.cache ?? getLocalCache();
  return withCache(generateMusicRaw, { storage });
}

// ---------------------------------------------------------------------------
// Speech
// ---------------------------------------------------------------------------

/**
 * Extract the children as a string array for segment mapping.
 * Returns the array if there are multiple string children, undefined for a single string.
 * Checks element.children (the normalized VargNode[]) since props.children is stripped by createElement.
 */
function getChildrenArray(
  element: VargElement<"speech">,
): string[] | undefined {
  const children = element.children;
  // Multiple string children → treat each as a segment
  if (children.length > 1 && children.every((c) => typeof c === "string")) {
    return children as string[];
  }
  return undefined;
}

/**
 * Pick non-transient speech props that should be preserved on segment elements.
 * Excludes `children` (set per-segment), `model` (transient/generation-only),
 * and `key` (unique per-element).
 */
function pickSpeechProps(props: SpeechProps): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  if (props.volume !== undefined) picked.volume = props.volume;
  if (props.voice !== undefined) picked.voice = props.voice;
  if (props.id !== undefined) picked.id = props.id;
  return picked;
}

/**
 * Filter words that overlap a segment's time range and rebase their timestamps
 * relative to the segment start (so the segment's audio starts at t=0).
 */
function rebaseWords(
  allWords: WordTiming[],
  segStart: number,
  segEnd: number,
): WordTiming[] {
  return allWords
    .filter((w) => w.end > segStart && w.start < segEnd)
    .map((w) => ({
      word: w.word,
      start: Math.max(0, w.start - segStart),
      end: Math.max(0, w.end - segStart),
    }));
}

/**
 * Pre-slice audio into Segment objects (ResolvedElement<"speech"> with timing metadata).
 * Each segment is a real ResolvedElement instance, so it works as a clip child,
 * video audio input, or captions source — no special handling needed in renderers.
 *
 * @param descriptors - Segment time ranges and text
 * @param fullFile - The full audio file to slice from
 * @param speechProps - Parent speech props to inherit (volume, voice, id)
 * @param allWords - Full word-level timing array for rebasing per-segment words
 */
async function sliceSegments(
  descriptors: SegmentDescriptor[],
  fullFile: File,
  speechProps: SpeechProps,
  allWords?: WordTiming[],
): Promise<Segment[]> {
  const inheritedProps = pickSpeechProps(speechProps);
  return Promise.all(
    descriptors.map(async (desc) => {
      const bytes = await sliceAudio(fullFile, desc.start, desc.end);
      const segmentFile = File.fromBuffer(bytes, "audio/mpeg");
      // Upload segment to storage so downstream cache keys use the URL
      // instead of serializing raw audio bytes (which can exceed Redis key limits).
      const ctx = getResolveContext();
      if (ctx?.storage) {
        await segmentFile.upload(ctx.storage);
      }

      // Rebase word timings relative to the segment's sliced audio (t=0)
      const segmentWords = allWords
        ? rebaseWords(allWords, desc.start, desc.end)
        : undefined;

      const resolved = new ResolvedElement<"speech">(
        { type: "speech", props: inheritedProps, children: [desc.text] },
        {
          file: segmentFile,
          duration: desc.duration,
          segments: [],
          words: segmentWords,
        },
      );
      // Attach timing metadata so segments[i].text/.start/.end work
      Object.defineProperties(resolved, {
        text: { value: desc.text, enumerable: true },
        start: { value: desc.start, enumerable: true },
        end: { value: desc.end, enumerable: true },
      });
      return resolved as Segment;
    }),
  );
}

/**
 * Extract a time range from an audio file using ffmpeg.
 * Re-encodes (not stream-copy) for sample-accurate cuts — MP3 stream-copy
 * can only cut at frame boundaries (~26ms granularity), causing audible
 * glitches at segment transitions.
 *
 * Adds a small safety padding (50ms) to capture any trailing silence
 * that exists in the original audio beyond the segment boundary.
 *
 * Routes through the FFmpegBackend when available (local or cloud/Rendi),
 * falling back to a direct local `ffmpeg` shell command only when no
 * backend exists (top-level `await` outside render()).
 */
const SLICE_PADDING_S = 0.05; // 50ms safety padding

async function sliceAudio(
  file: File,
  start: number,
  end: number,
): Promise<Uint8Array> {
  const ctx = getResolveContext();
  const duration = end - start + SLICE_PADDING_S;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const outPath = `/tmp/varg-segment-${suffix}.mp3`;

  if (ctx?.backend) {
    // Use the backend abstraction (works for both local ffmpeg and cloud/Rendi).
    // -ss goes in input options (before -i for fast seek).
    const result = await ctx.backend.run({
      inputs: [{ path: file, options: ["-ss", String(start)] }],
      outputArgs: [
        "-t",
        String(duration),
        "-acodec",
        "libmp3lame",
        "-q:a",
        "2",
      ],
      outputPath: outPath,
    });

    // Rendi returns a URL, local backend returns a file path.
    if (result.output.type === "url") {
      const response = await fetch(result.output.url);
      return new Uint8Array(await response.arrayBuffer());
    }
    const sliced = await Bun.file(result.output.path).arrayBuffer();
    try {
      await Bun.file(result.output.path).delete?.();
    } catch {
      /* ignore cleanup errors */
    }
    return new Uint8Array(sliced);
  }

  // Fallback: no backend (top-level `await` outside render()) — use local ffmpeg directly.
  const inputPath = await file.toTempFile();
  const sliceResult =
    await $`ffmpeg -y -ss ${start} -i ${inputPath} -t ${duration} -acodec libmp3lame -q:a 2 ${outPath}`
      .quiet()
      .nothrow();
  if (sliceResult.exitCode !== 0) {
    const stderr = sliceResult.stderr.toString().trim();
    throw new Error(
      `ffmpeg audio slice failed (exit ${sliceResult.exitCode}): ${stderr || "unknown error"}`,
    );
  }

  const sliced = await Bun.file(outPath).arrayBuffer();
  try {
    await Bun.file(outPath).delete?.();
  } catch {
    /* ignore cleanup errors */
  }
  return new Uint8Array(sliced);
}

/** Generate speech audio via the AI SDK and return a ResolvedElement with duration metadata. */
export async function resolveSpeechElement(
  element: VargElement<"speech">,
  props: SpeechProps,
): Promise<ResolvedElement<"speech">> {
  // Join array children with " " so ElevenLabs gets proper word boundaries
  // between segments (e.g., "bananas. Bananas" not "bananas.Bananas").
  // getTextContent joins with "" which loses inter-segment spacing.
  const childrenArray = getChildrenArray(element);
  const text = childrenArray
    ? childrenArray.join(" ")
    : getTextContent(element.children);
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

  const { audio, ...rest } = await generateSpeechAI({
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

  const duration = await probeDuration(file);

  // Extract alignment data if the provider returned it (ElevenLabs with-timestamps).
  // The AI SDK passes provider-specific data via `providerMetadata`.
  const providerMeta = (
    rest as { providerMetadata?: Record<string, Record<string, unknown>> }
  ).providerMetadata;
  const elevenLabsMeta = providerMeta?.elevenlabs;
  const alignment = elevenLabsMeta?.alignment as
    | ElevenLabsCharacterAlignment
    | undefined;

  let words: WordTiming[] | undefined;
  let segments: Segment[] | undefined;

  if (alignment) {
    words = parseElevenLabsAlignment(alignment);

    // Build segments if children was an array
    if (childrenArray && childrenArray.length > 0 && words.length > 0) {
      const descriptors = mapWordsToSegments(words, childrenArray, duration);
      segments = await sliceSegments(descriptors, file, props, words);
    } else if (words.length > 0) {
      // Single string — one segment spanning the full probed audio duration
      // (not word bounds, which would trim leading/trailing silence)
      segments = await sliceSegments(
        [{ text, start: 0, end: duration, duration }],
        file,
        props,
        words,
      );
    }
  }

  return new ResolvedElement(element, {
    file,
    duration,
    words,
    segments,
  });
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

/** Resolve an image input (URL, path, Uint8Array, or nested Image element) to raw bytes. */
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
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image from ${input}: ${response.status}`,
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    }
    // Local file path — resolve via backend if available
    const ctx = getResolveContext();
    if (ctx?.backend) {
      const path = await ctx.backend.resolvePath(File.fromPath(input));
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image from ${path}: ${response.status}`,
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    }
    // Local fallback
    const response = await fetch(`file://${input}`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from ${input}: ${response.status}`,
      );
    }
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
    return await resolved.file.arrayBuffer();
  }
  throw new Error(`Unsupported image input type: ${typeof input}`);
}

/** Resolve an image prompt, converting any nested image references to raw bytes. */
async function resolveImagePrompt(
  prompt: ImagePrompt,
): Promise<string | { text?: string; images: Uint8Array[] }> {
  if (typeof prompt === "string") return prompt;
  const resolvedImages = await Promise.all(
    prompt.images.map((img) => resolveImageInputForStandalone(img)),
  );
  return { text: prompt.text, images: resolvedImages };
}

/** Generate an image via the AI SDK (or load from src) and return a ResolvedElement. */
export async function resolveImageElement(
  element: VargElement<"image">,
  props: ImageProps,
): Promise<ResolvedElement<"image">> {
  if (props.src) {
    const src = props.src as string;
    const file = src.startsWith("http")
      ? File.fromUrl(src)
      : File.fromPath(src.startsWith("file://") ? src.slice(7) : src);

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
/** Generate a video via the AI SDK (or load from src) and return a ResolvedElement. */
export async function resolveVideoElement(
  element: VargElement<"video">,
  props: Record<string, unknown>,
): Promise<ResolvedElement<"video">> {
  if (props.src && !props.prompt) {
    const src = props.src as string;
    const file = src.startsWith("http")
      ? File.fromUrl(src)
      : File.fromPath(src.startsWith("file://") ? src.slice(7) : src);
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
              if (!res.ok) {
                throw new Error(
                  `Failed to fetch image from ${img}: ${res.status} ${res.statusText}`,
                );
              }
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
                return await imgEl.meta.file.arrayBuffer();
              }
              const resolved = await resolveImageElement(
                imgEl,
                imgEl.props as ImageProps,
              );
              return await resolved.file.arrayBuffer();
            }
            throw new Error("Unsupported image input in Video prompt");
          }),
        )
      : undefined;

    let resolvedAudio: Uint8Array | undefined;
    if (promptObj.audio) {
      if (promptObj.audio instanceof Uint8Array) {
        resolvedAudio = promptObj.audio;
      } else if (typeof promptObj.audio === "string") {
        const res = await fetch(promptObj.audio);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch audio from ${promptObj.audio}: ${res.status} ${res.statusText}`,
          );
        }
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

    let resolvedVideo: Uint8Array | undefined;
    if (promptObj.video) {
      if (promptObj.video instanceof Uint8Array) {
        resolvedVideo = promptObj.video;
      } else if (typeof promptObj.video === "string") {
        const res = await fetch(promptObj.video);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch video from ${promptObj.video}: ${res.status} ${res.statusText}`,
          );
        }
        resolvedVideo = new Uint8Array(await res.arrayBuffer());
      } else if (
        promptObj.video &&
        typeof promptObj.video === "object" &&
        "type" in promptObj.video
      ) {
        const videoEl = promptObj.video as VargElement<"video">;
        if (videoEl.meta?.file) {
          resolvedVideo = await videoEl.meta.file.arrayBuffer();
        } else {
          const resolved = await resolveVideoElement(
            videoEl,
            videoEl.props as Record<string, unknown>,
          );
          resolvedVideo = await resolved.file.arrayBuffer();
        }
      }
    }

    resolvedPrompt = {
      text: promptObj.text,
      images: resolvedImages,
      audio: resolvedAudio,
      video: resolvedVideo,
    };
  }

  const generateVideo = getCachedGenerateVideo();

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
/** Generate music audio via the AI SDK and return a ResolvedElement with duration metadata. */
export async function resolveMusicElement(
  element: VargElement<"music">,
  props: MusicProps,
): Promise<ResolvedElement<"music">> {
  const prompt = props.prompt;
  const model = props.model;

  if (!prompt || !model) {
    throw new Error("await Music() requires 'prompt' and 'model' props");
  }

  const generateMusic = getCachedGenerateMusic();
  const cacheKey = computeCacheKey(element);

  const { audio } = await generateMusic({
    model,
    prompt,
    duration: props.duration,
    cacheKey,
  });

  const file = File.fromGenerated({
    uint8Array: audio.uint8Array,
    mediaType: "audio/mpeg",
  }).withMetadata({
    type: "music",
    model: typeof model === "string" ? model : model.modelId,
    prompt,
  });

  const duration = await probeDuration(file);

  return new ResolvedElement(element, {
    file,
    duration,
  });
}
