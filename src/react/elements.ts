import { type AudioNode, makeAudioNode } from "./audio-element";
import {
  resolveFFmpegElement,
  resolveImageElement,
  resolveMusicElement,
  resolveProbeElement,
  resolveSliceElement,
  resolveSpeechElement,
  resolveTalkingHeadElement,
  resolveVideoElement,
} from "./resolve";
import type { ResolvedElement } from "./resolved-element";
import type {
  CaptionsProps,
  ClipProps,
  FFmpegProps,
  ImageProps,
  MusicProps,
  OverlayProps,
  PackshotProps,
  ProbeProps,
  RenderProps,
  SliceProps,
  SliderProps,
  SpeechProps,
  SubtitleProps,
  SwipeProps,
  TalkingHeadProps,
  TitleProps,
  VargElement,
  VargNode,
  VideoProps,
} from "./types";

function normalizeChildren(children: unknown): VargNode[] {
  if (children === null || children === undefined) return [];
  if (Array.isArray(children))
    return children.flat().flatMap(normalizeChildren);
  return [children as VargNode];
}

function createElement<T extends VargElement["type"]>(
  type: T,
  props: Record<string, unknown>,
  children: unknown,
): VargElement<T> {
  const { children: _, ...restProps } = props;
  return {
    type,
    props: restProps,
    children: normalizeChildren(children ?? props.children),
  };
}

/**
 * Attach a `.then()` method to a VargElement, making it awaitable.
 *
 * - Without `await`: returns the plain VargElement (backward compatible).
 * - With `await`: triggers AI generation and returns a ResolvedElement
 *   with `.duration`, `.file`, and `.meta` populated.
 *
 * The resolution promise is memoized: re-awaiting the same element returns
 * the same ResolvedElement without re-triggering generation. The resolved
 * meta is also written back onto the element so the render pipeline sees
 * it as pre-resolved.
 */
function makeThenable<T extends VargElement["type"]>(
  element: VargElement<T>,
  resolver: (el: VargElement<T>) => Promise<ResolvedElement<T>>,
): VargElement<T> & PromiseLike<ResolvedElement<T>> {
  const thenable = element as VargElement<T> & {
    then?: PromiseLike<ResolvedElement<T>>["then"];
  };

  let resolvedPromise: Promise<ResolvedElement<T>> | undefined;

  // biome-ignore lint/suspicious/noThenProperty: intentional — makes element awaitable
  thenable.then = function (resolve, reject) {
    resolvedPromise ??= resolver(this as VargElement<T>).then((r) => {
      // Mirror meta onto the original element so the render pipeline
      // treats it as pre-resolved (single generation per element).
      element.meta = r.meta;
      return r;
    });
    return resolvedPromise.then(resolve, reject);
  };

  return thenable as VargElement<T> & PromiseLike<ResolvedElement<T>>;
}

/**
 * Attach a memoized lazy `.audio` getter to a media element.
 * `video.audio` / `speech.audio` returns the same derived AudioNode on
 * every access; resolving it resolves the parent first.
 */
function attachAudioGetter<
  T extends
    | VargElement<"video">
    | VargElement<"speech">
    | VargElement<"talking-head">,
>(element: T): T & { readonly audio: AudioNode } {
  let node: AudioNode | undefined;
  Object.defineProperty(element, "audio", {
    get() {
      node ??= makeAudioNode({
        parent: element as VargElement<"video"> | VargElement<"speech">,
      });
      return node;
    },
    // A getter with no setter makes `el.audio = x` throw "Attempted to assign
    // to readonly property" in strict mode (all ESM). Callers legitimately
    // overwrite this: render's dry-run validator replaces the awaitable
    // element's fields with mocks (`el.audio = el`) so user code can run
    // without hitting AI providers, and that assignment broke every render
    // whose TSX contained a Speech or Video element. Accepting a replacement
    // keeps the lazy default while leaving the property writable.
    set(replacement: AudioNode) {
      node = replacement;
    },
    enumerable: false,
    configurable: true,
  });
  return element as T & { readonly audio: AudioNode };
}

/**
 * Expand the `audio: "native"` sugar on VideoProps:
 * - `keepAudio: true` (unless explicitly set — conflicts are reported by compile())
 * - `generate_audio: true` in the model's provider options
 *
 * The `audio` prop itself is excluded from cache keys (see
 * IGNORED_PROPS_BY_TYPE) — the expanded providerOptions carry the
 * semantic difference, so pre-existing configurations keep their keys.
 *
 * Provider mapping:
 * - direct fal models → `providerOptions.fal.generate_audio`
 * - varg gateway models → `providerOptions.varg.audio` (the UNIFIED field —
 *   lifted to the request body top level by VargVideoModel and mapped per
 *   model by the API's mapping_rules; models without native-audio support
 *   silently ignore it). Do NOT inject provider_options.fal.generate_audio
 *   here: the API rejects unknown provider_options keys with a 422, so the
 *   old blind injection broke every fal video model whose schema lacks
 *   generate_audio.
 */
function expandNativeAudio(props: VideoProps): VideoProps {
  if (props.audio !== "native") return props;

  const provider =
    props.model && typeof props.model === "object" && "provider" in props.model
      ? String(props.model.provider).split(".")[0]
      : undefined;

  const providerOptions = { ...(props.providerOptions ?? {}) } as Record<
    string,
    Record<string, unknown>
  >;

  if (provider === "varg") {
    const vargOpts = { ...(providerOptions.varg ?? {}) } as Record<
      string,
      unknown
    >;
    // Unified native-audio request — best-effort by design: the varg API
    // maps it to the provider's own flag on models that support it and
    // silently drops it elsewhere (mapping_rules, migration 0147).
    if (vargOpts.audio === undefined) vargOpts.audio = true;
    providerOptions.varg = vargOpts as Record<string, unknown>;
  } else {
    // Default to the fal namespace (fal is the only provider with a
    // verified generate_audio flag; harmless for providers that ignore it).
    const key = provider ?? "fal";
    const opts = { ...(providerOptions[key] ?? {}) };
    if (opts.generate_audio === undefined) opts.generate_audio = true;
    providerOptions[key] = opts;
  }

  return {
    ...props,
    keepAudio: props.keepAudio ?? true,
    providerOptions:
      providerOptions as unknown as VideoProps["providerOptions"],
  };
}

// ---------------------------------------------------------------------------
// Element factories
// ---------------------------------------------------------------------------

export function Render(props: RenderProps): VargElement<"render"> {
  return createElement(
    "render",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Clip(props: ClipProps): VargElement<"clip"> {
  return createElement(
    "clip",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Overlay(props: OverlayProps): VargElement<"overlay"> {
  return createElement(
    "overlay",
    props as Record<string, unknown>,
    props.children,
  );
}

/**
 * Named element types returned by the media factories — for typing user
 * code (e.g. async component props) without `ReturnType<typeof Video>`
 * acrobatics.
 */
export type ImageElement = VargElement<"image"> &
  PromiseLike<ResolvedElement<"image">>;
export type VideoElement = VargElement<"video"> &
  PromiseLike<ResolvedElement<"video">> & { readonly audio: AudioNode };
export type SpeechElement = VargElement<"speech"> &
  PromiseLike<ResolvedElement<"speech">> & { readonly audio: AudioNode };

export function Image(props: ImageProps): ImageElement {
  const element = createElement(
    "image",
    props as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveImageElement(el, el.props as unknown as ImageProps),
  );
}

export function Video(props: VideoProps): VideoElement {
  const element = createElement(
    "video",
    expandNativeAudio(props) as Record<string, unknown>,
    undefined,
  );
  return attachAudioGetter(
    makeThenable(element, (el) =>
      resolveVideoElement(el, el.props as Record<string, unknown>),
    ),
  );
}

export function Speech(props: SpeechProps): SpeechElement {
  const element = createElement(
    "speech",
    props as Record<string, unknown>,
    props.children,
  );
  return attachAudioGetter(
    makeThenable(element, (el) =>
      resolveSpeechElement(el, el.props as unknown as SpeechProps),
    ),
  );
}

export function TalkingHead(
  props: TalkingHeadProps,
): VargElement<"talking-head"> & PromiseLike<ResolvedElement<"talking-head">> {
  const element = createElement(
    "talking-head",
    props as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveTalkingHeadElement(el, el.props as unknown as TalkingHeadProps),
  );
}

export function Title(props: TitleProps): VargElement<"title"> {
  return createElement(
    "title",
    props as Record<string, unknown>,
    props.children ?? props.text,
  );
}

export function Subtitle(props: SubtitleProps): VargElement<"subtitle"> {
  return createElement(
    "subtitle",
    props as Record<string, unknown>,
    props.children ?? props.text,
  );
}

export function Music(
  props: MusicProps,
): VargElement<"music"> & PromiseLike<ResolvedElement<"music">> {
  const element = createElement(
    "music",
    props as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveMusicElement(el, el.props as unknown as MusicProps),
  );
}

export function Captions(props: CaptionsProps): VargElement<"captions"> {
  return createElement("captions", props as Record<string, unknown>, undefined);
}

export function Slider(props: SliderProps): VargElement<"slider"> {
  return createElement(
    "slider",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Swipe(props: SwipeProps): VargElement<"swipe"> {
  return createElement(
    "swipe",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Packshot(props: PackshotProps): VargElement<"packshot"> {
  return createElement("packshot", props as Record<string, unknown>, undefined);
}

// ---------------------------------------------------------------------------
// FFmpeg processing elements (awaitable, resolve via gateway/Rendi)
// ---------------------------------------------------------------------------

/**
 * Slice a video into segments. Returns `{ segments }` when awaited —
 * same pattern as `Speech({ children: [...] })`.
 *
 * Modes: `every` (interval), `at` (timestamps), `count` (equal parts), `ranges`.
 *
 * ```tsx
 * const { segments } = await Slice({ src: video, every: 5 });
 * segments[0].file, segments[0].duration, segments[0].url
 * ```
 */
export function Slice(
  props: SliceProps,
): VargElement<"slice"> & PromiseLike<ResolvedElement<"slice">> {
  const element = createElement(
    "slice",
    props as unknown as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveSliceElement(el, el.props as unknown as SliceProps),
  );
}

/**
 * Run an arbitrary FFmpeg command. When awaited, returns a `ResolvedElement`
 * with the processed output file.
 *
 * ```tsx
 * const result = await FFmpeg({
 *   src: video,
 *   command: "-vf scale=1920:1080 -c:a copy",
 * });
 * result.file, result.url
 * ```
 */
export function FFmpeg(
  props: FFmpegProps,
): VargElement<"ffmpeg"> & PromiseLike<ResolvedElement<"ffmpeg">> {
  const element = createElement(
    "ffmpeg",
    props as unknown as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveFFmpegElement(el, el.props as unknown as FFmpegProps),
  );
}

/**
 * Probe a media file's metadata. When awaited, returns a `ResolvedElement`
 * with duration, resolution, codec, and other info in `.meta`.
 *
 * ```tsx
 * const info = await Probe({ src: "https://s3.varg.ai/o/video.mp4" });
 * info.duration, info.meta.width, info.meta.height
 * ```
 */
export function Probe(
  props: ProbeProps,
): VargElement<"probe"> & PromiseLike<ResolvedElement<"probe">> {
  const element = createElement(
    "probe",
    props as unknown as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveProbeElement(el, el.props as unknown as ProbeProps),
  );
}
