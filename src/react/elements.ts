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
 * The `.then()` is consumed on first call (deleted) to prevent
 * double-resolution if the element is re-awaited.
 */
function makeThenable<T extends VargElement["type"]>(
  element: VargElement<T>,
  resolver: (el: VargElement<T>) => Promise<ResolvedElement<T>>,
): VargElement<T> & PromiseLike<ResolvedElement<T>> {
  const thenable = element as VargElement<T> & {
    then?: PromiseLike<ResolvedElement<T>>["then"];
  };

  // biome-ignore lint/suspicious/noThenProperty: intentional — makes element awaitable
  thenable.then = function (resolve, reject) {
    // Remove .then to prevent double-resolution
    delete this.then;
    return resolver(this as VargElement<T>).then(resolve, reject);
  };

  return thenable as VargElement<T> & PromiseLike<ResolvedElement<T>>;
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

export function Image(
  props: ImageProps,
): VargElement<"image"> & PromiseLike<ResolvedElement<"image">> {
  const element = createElement(
    "image",
    props as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveImageElement(el, el.props as unknown as ImageProps),
  );
}

export function Video(
  props: VideoProps,
): VargElement<"video"> & PromiseLike<ResolvedElement<"video">> {
  const element = createElement(
    "video",
    props as Record<string, unknown>,
    undefined,
  );
  return makeThenable(element, (el) =>
    resolveVideoElement(el, el.props as Record<string, unknown>),
  );
}

export function Speech(
  props: SpeechProps,
): VargElement<"speech"> & PromiseLike<ResolvedElement<"speech">> {
  const element = createElement(
    "speech",
    props as Record<string, unknown>,
    props.children,
  );
  return makeThenable(element, (el) =>
    resolveSpeechElement(el, el.props as unknown as SpeechProps),
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
