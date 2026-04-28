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
import { type CacheStorage, depsToKey, withCache } from "../ai-sdk/cache";
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
  TalkingHeadProps,
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

/** Probe duration via local ffprobe shell command (fallback for top-level await).
 *  When the file has a URL, passes it directly to ffprobe which uses HTTP range
 *  requests to read only the moov atom (~200KB) — no full video download. */
async function probeDurationLocal(file: File): Promise<number> {
  try {
    const target = file.url ?? (await file.toTempFile());
    const result =
      await $`ffprobe -v error -show_entries format=duration -of json ${target}`.json();
    const duration = Number.parseFloat(result?.format?.duration ?? "0");
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Video trimming — trims a source video to a time range via local ffmpeg.
// Used to pre-trim prompt.video inputs before sending to AI models that
// have input length limits (e.g. motion-control max 30s).
// ---------------------------------------------------------------------------
/** Trim a video file to [cutFrom, cutTo] via local ffmpeg.
 *  Uses the URL directly when available (no full pre-download via range seek).
 *  Returns a new File with the trimmed video data. */
async function trimVideoLocal(
  file: File,
  cutFrom: number,
  cutTo: number,
): Promise<File> {
  const input = file.url ?? (await file.toTempFile());
  const tmpDir = process.env.TMPDIR ?? "/tmp";
  const outPath = `${tmpDir}/varg-trim-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const duration = cutTo - cutFrom;

  await $`ffmpeg -y -ss ${cutFrom} -i ${input} -t ${duration} -c copy -movflags +faststart ${outPath}`.quiet();

  const data = await Bun.file(outPath).arrayBuffer();
  await Bun.file(outPath).delete?.();
  return File.fromBuffer(new Uint8Array(data), "video/mp4");
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

/** Get a cached generateSpeech wrapper using the active cache storage. */
function getCachedGenerateSpeech() {
  const storage = getActiveCache();
  return withCache(generateSpeechAI, { storage });
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

// ---------------------------------------------------------------------------
// Speech resolve-level cache: serialization helpers
// ---------------------------------------------------------------------------

/** Serializable representation of a speech segment for caching. */
interface CachedSegment {
  text: string;
  start: number;
  end: number;
  duration: number;
  props: Record<string, unknown>;
  children: string[];
  file: { uint8Array: Uint8Array; mediaType: string };
  words?: WordTiming[];
}

/** Serializable representation of a full resolved speech for caching. */
interface CachedSpeechResult {
  file: { uint8Array: Uint8Array; mediaType: string };
  duration: number;
  words?: WordTiming[];
  segments?: CachedSegment[];
}

/** Reconstruct a Segment (ResolvedElement<"speech"> + timing props) from cached data. */
function reconstructSegment(
  cached: CachedSegment,
  storage?: import("../ai-sdk/storage/types").StorageProvider,
): Segment {
  const segmentFile = File.fromBuffer(
    cached.file.uint8Array,
    cached.file.mediaType,
  );
  const resolved = new ResolvedElement<"speech">(
    { type: "speech", props: cached.props, children: cached.children },
    {
      file: segmentFile,
      duration: cached.duration,
      segments: [],
      words: cached.words,
    },
  );
  Object.defineProperties(resolved, {
    text: { value: cached.text, enumerable: true },
    start: { value: cached.start, enumerable: true },
    end: { value: cached.end, enumerable: true },
  });
  return resolved as Segment;
}

/** Serialize a Segment into a cacheable plain object. */
function serializeSegment(seg: Segment): CachedSegment {
  return {
    text: seg.text,
    start: seg.start,
    end: seg.end,
    duration: seg.duration,
    props: { ...seg.props },
    children: seg.children.filter((c): c is string => typeof c === "string"),
    file: {
      uint8Array: (seg.meta.file as any)._data as Uint8Array,
      mediaType: "audio/mpeg",
    },
    words: seg.meta.words,
  };
}

// ---------------------------------------------------------------------------
// resolveSpeechElement — cached at the full-result level
// ---------------------------------------------------------------------------

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

  // ---- Check full-result cache (includes segments, words, duration) ----
  const cache = getActiveCache();
  const resolveKey = depsToKey("resolveSpeech", cacheKey);
  const cached = (await cache.get(resolveKey)) as
    | CachedSpeechResult
    | undefined;

  if (cached) {
    const ctx = getResolveContext();
    const file = File.fromGenerated({
      uint8Array: cached.file.uint8Array,
      mediaType: cached.file.mediaType,
    }).withMetadata({
      type: "speech",
      model: typeof model === "string" ? model : model.modelId,
      prompt: text,
    });

    // Upload reconstructed segment files to storage so downstream cache keys
    // get stable URLs (instead of no URL at all).
    const segments = cached.segments?.map((s) =>
      reconstructSegment(s, ctx?.storage),
    );
    if (segments && ctx?.storage) {
      await Promise.all(
        segments.map((seg) => seg.meta.file.upload(ctx.storage!)),
      );
    }

    return new ResolvedElement(element, {
      file,
      duration: cached.duration,
      words: cached.words,
      segments,
    });
  }

  // ---- Cache miss: generate, probe, slice, then cache ----

  const generateSpeech = getCachedGenerateSpeech();
  const { audio, ...rest } = await generateSpeech({
    model,
    text,
    voice: props.voice ?? "rachel",
    cacheKey,
  });

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

  // ---- Write full result to cache ----
  const toCache: CachedSpeechResult = {
    file: { uint8Array: audio.uint8Array, mediaType },
    duration,
    words,
    segments: segments?.map(serializeSegment),
  };
  await cache.set(resolveKey, toCache);

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
  const resolvedImages = prompt.images
    ? await Promise.all(
        prompt.images.map((img) => resolveImageInputForStandalone(img)),
      )
    : [];
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
    // Probe duration via local CPU ffprobe (HTTP range request for URLs,
    // no full download). Intentionally uses probeDurationLocal instead of
    // probeDuration to avoid Rendi's slow remux-based probe on cloud.
    const fullDuration = await probeDurationLocal(file);

    const cutFrom = props.cutFrom as number | undefined;
    const cutTo = props.cutTo as number | undefined;

    // When cutFrom/cutTo are set, trim the video via local ffmpeg.
    // This is used to pre-split source videos for models with input length
    // limits (e.g. motion-control max 30s). The trimmed File replaces the
    // original so downstream consumers (prompt.video) get only the segment.
    if (cutFrom !== undefined || cutTo !== undefined) {
      const start = cutFrom ?? 0;
      const end = cutTo ?? fullDuration;
      const trimmedFile = await trimVideoLocal(file, start, end);
      const trimmedDuration = end - start;
      return new ResolvedElement(element, {
        file: trimmedFile,
        duration: trimmedDuration,
      });
    }

    return new ResolvedElement(element, {
      file,
      duration: fullDuration,
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
// FFmpeg processing resolvers (Slice, FFmpeg, Probe)
// ---------------------------------------------------------------------------

/** Resolve the source URL from a string, File, or ResolvedElement. */
async function resolveSourceUrl(
  src:
    | string
    | File
    | { meta?: { file?: File }; props?: Record<string, unknown> },
): Promise<string> {
  if (typeof src === "string") return src;
  if (src instanceof File) return src.url ?? (await src.toTempFile());
  if (src.meta?.file)
    return src.meta.file.url ?? (await src.meta.file.toTempFile());
  throw new Error("cannot resolve source URL from input");
}

/** Get the varg gateway client settings. */
function getGatewayConfig(): { apiKey: string; baseUrl: string } | null {
  const apiKey = process.env.VARG_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.VARG_API_URL ?? "https://api.varg.ai",
  };
}

/** Call gateway and wait for job completion. */
async function gatewayJobRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const config = getGatewayConfig();
  if (!config) throw new Error("VARG_API_KEY not set");

  const submitRes = await fetch(`${config.baseUrl}/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`gateway ${path} failed: ${submitRes.status} ${text}`);
  }
  const job = (await submitRes.json()) as {
    job_id: string;
    status: string;
    output?: Record<string, unknown>;
  };

  if (job.status === "completed" && job.output) return job;

  const maxAttempts = 300;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2_000));
    const pollRes = await fetch(`${config.baseUrl}/v1/jobs/${job.job_id}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!pollRes.ok) continue;
    const result = (await pollRes.json()) as {
      status: string;
      output?: Record<string, unknown>;
      error?: string;
    };
    if (result.status === "completed") return result;
    if (result.status === "failed")
      throw new Error(`gateway job failed: ${result.error ?? "unknown"}`);
  }
  throw new Error("gateway job timed out");
}

/**
 * Resolve a Slice element -- splits video into segments.
 * Returns a ResolvedElement with `.segments` populated (same pattern as Speech).
 */
export async function resolveSliceElement(
  element: VargElement<"slice">,
  props: import("./types").SliceProps,
): Promise<ResolvedElement<"slice">> {
  const srcUrl = await resolveSourceUrl(props.src);

  const body: Record<string, unknown> = {
    video_url: srcUrl,
    codec: props.codec ?? "copy",
  };
  if (props.every !== undefined) body.every = props.every;
  if (props.at !== undefined) body.at = props.at;
  if (props.count !== undefined) body.count = props.count;
  if (props.ranges !== undefined) body.ranges = props.ranges;

  const result = await gatewayJobRequest("/ffmpeg/slice", body);
  const output = result.output as
    | { url?: string; metadata?: Record<string, unknown> }
    | undefined;
  const metadata = output?.metadata as
    | {
        segments?: Array<{ url: string; index: number; filename: string }>;
        total_segments?: number;
      }
    | undefined;

  const segmentData = metadata?.segments ?? [];

  // biome-ignore lint/suspicious/noExplicitAny: segment construction requires flexible typing
  const segments: any[] = [];
  for (const seg of segmentData) {
    const segFile = File.fromUrl(seg.url);
    const segDuration = await probeDuration(segFile);
    const segElement = new ResolvedElement(
      { type: "video" as const, props: { src: seg.url }, children: [] },
      { file: segFile, duration: segDuration },
    );
    segments.push(
      Object.assign(segElement, {
        text: seg.filename,
        start: 0,
        end: segDuration,
        index: seg.index,
        url: seg.url,
      }),
    );
  }

  const firstFile = segmentData[0]
    ? File.fromUrl(segmentData[0].url)
    : File.fromBuffer(new Uint8Array(0), "video/mp4");

  return new ResolvedElement(element, {
    file: firstFile,
    duration: 0,
    segments,
  });
}

/**
 * Resolve an FFmpeg element -- runs arbitrary FFmpeg command via gateway.
 */
export async function resolveFFmpegElement(
  element: VargElement<"ffmpeg">,
  props: import("./types").FFmpegProps,
): Promise<ResolvedElement<"ffmpeg">> {
  const inputFiles: Record<string, string> = {};
  if (props.src) {
    inputFiles.in_1 = await resolveSourceUrl(props.src);
  }
  if (props.inputs) {
    for (const [key, val] of Object.entries(props.inputs)) {
      inputFiles[key] = await resolveSourceUrl(val);
    }
  }

  let command = props.command;
  if (props.src && !command.includes("{{in_1}}")) {
    command = `-i {{in_1}} ${command} {{out_1}}`;
  }

  const outputFiles = command.includes("OUTPUT_FOLDER")
    ? "OUTPUT_FOLDER"
    : { out_1: "output.mp4" };

  const result = await gatewayJobRequest("/ffmpeg", {
    command,
    input_files: inputFiles,
    output_files: outputFiles,
  });

  const output = result.output as
    | { url?: string; media_type?: string }
    | undefined;
  const url = output?.url ?? "";
  const file = url
    ? File.fromUrl(url)
    : File.fromBuffer(new Uint8Array(0), "video/mp4");
  const duration = url ? await probeDuration(file) : 0;

  return new ResolvedElement(element, { file, duration });
}

/**
 * Resolve a Probe element -- gets media metadata via gateway.
 */
export async function resolveProbeElement(
  element: VargElement<"probe">,
  props: import("./types").ProbeProps,
): Promise<ResolvedElement<"probe">> {
  const srcUrl = await resolveSourceUrl(props.src);

  const config = getGatewayConfig();
  if (!config) throw new Error("VARG_API_KEY not set");

  const res = await fetch(`${config.baseUrl}/v1/ffmpeg/probe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ url: srcUrl }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`probe failed: ${res.status} ${text}`);
  }

  const probeData = (await res.json()) as {
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
    audio_codec?: string;
    format?: string;
    bitrate?: number;
    fps?: number;
    size_bytes?: number;
  };

  const file = File.fromUrl(srcUrl);

  const resolved = new ResolvedElement(element, {
    file,
    duration: probeData.duration ?? 0,
  });

  return Object.assign(resolved, {
    width: probeData.width,
    height: probeData.height,
    codec: probeData.codec,
    audioCodec: probeData.audio_codec,
    format: probeData.format,
    bitrate: probeData.bitrate,
    fps: probeData.fps,
    sizeBytes: probeData.size_bytes,
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

// ---------------------------------------------------------------------------
// TalkingHead
// ---------------------------------------------------------------------------
/**
 * Resolve a TalkingHead element by combining a pre-resolved image and speech
 * into a lipsync video. Returns a ResolvedElement<"talking-head"> wrapping the
 * final video.
 *
 * Pipeline:
 * 1. Resolve the image from `image` prop (generate or reuse pre-resolved)
 * 2. Resolve the speech from `audio` prop (generate or reuse pre-resolved)
 * 3. Generate lipsync video from image + audio via `model`
 */
export async function resolveTalkingHeadElement(
  element: VargElement<"talking-head">,
  props: TalkingHeadProps,
): Promise<ResolvedElement<"talking-head">> {
  const model = props.model;
  if (!model) {
    throw new Error(
      "await TalkingHead() requires 'model' prop for lipsync video generation",
    );
  }

  if (!props.image) {
    throw new Error(
      "await TalkingHead() requires 'image' prop (an Image element).",
    );
  }

  if (!props.audio) {
    throw new Error(
      "await TalkingHead() requires 'audio' prop (a Speech element).",
    );
  }

  // Step 1: Resolve image — if it's a ResolvedElement, use its file directly;
  // otherwise resolve the lazy Image element via generateImage.
  const resolvedImage =
    props.image instanceof ResolvedElement
      ? props.image
      : await resolveImageElement(props.image, props.image.props as ImageProps);
  const characterBytes = new Uint8Array(await resolvedImage.file.arrayBuffer());

  // Step 2: Resolve speech — same pattern.
  const resolvedSpeech =
    props.audio instanceof ResolvedElement
      ? props.audio
      : await resolveSpeechElement(
          props.audio,
          props.audio.props as SpeechProps,
        );
  const speechBytes = new Uint8Array(await resolvedSpeech.file.arrayBuffer());

  // Step 3: Generate lipsync video (image + audio → video)
  const lipsyncModel = props.lipsyncModel ?? model;
  const generateVideo = getCachedGenerateVideo();

  // Pass image + audio to the lipsync model. Models like veed-fabric and
  // omnihuman accept images directly. For standalone await TalkingHead(),
  // we don't support the animate-then-lipsync path (use render() for that).
  const { video } = await generateVideo({
    model: lipsyncModel as Parameters<typeof generateVideoRaw>[0]["model"],
    prompt: {
      images: [characterBytes],
      audio: speechBytes,
    },
    duration: 0, // duration determined by audio length
  });

  const mediaType = video.mimeType ?? "video/mp4";
  const modelId =
    typeof lipsyncModel === "string" ? lipsyncModel : lipsyncModel.modelId;

  const promptLabel =
    getTextContent(element.children) ?? "talking-head lipsync";

  const file = File.fromGenerated({
    uint8Array: video.uint8Array,
    mediaType,
    url: (video as { url?: string }).url,
  }).withMetadata({
    type: "video",
    model: modelId,
    prompt: `talking-head: ${promptLabel.slice(0, 100)}`,
  });

  const duration = await probeDuration(file);

  return new ResolvedElement(element, {
    file,
    duration,
  });
}
