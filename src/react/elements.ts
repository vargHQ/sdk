import {
  resolveImageElement,
  resolveMusicElement,
  resolveSpeechElement,
  resolveVideoElement,
} from "./resolve";
import type { ResolvedElement } from "./resolved-element";
import type {
  CaptionsProps,
  ClipProps,
  ImageProps,
  MusicProps,
  OverlayProps,
  PackshotProps,
  RenderProps,
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

/** Flatten and normalize children into a VargNode array. */
function normalizeChildren(children: unknown): VargNode[] {
  if (children === null || children === undefined) return [];
  if (Array.isArray(children))
    return children.flat().flatMap(normalizeChildren);
  return [children as VargNode];
}

/** Create a VargElement with the given type, props, and normalized children. */
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

/** Create a `<Render>` root element that defines the video composition. */
export function Render(props: RenderProps): VargElement<"render"> {
  return createElement(
    "render",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create a `<Clip>` element representing a time segment in the video timeline. */
export function Clip(props: ClipProps): VargElement<"clip"> {
  return createElement(
    "clip",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create an `<Overlay>` element for picture-in-picture or watermark layers. */
export function Overlay(props: OverlayProps): VargElement<"overlay"> {
  return createElement(
    "overlay",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create an `<Image>` element. Awaitable: `await Image({...})` generates the image and returns a ResolvedElement. */
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

/** Create a `<Video>` element. Awaitable: `await Video({...})` generates the video and returns a ResolvedElement. */
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

/** Create a `<Speech>` element. Awaitable: `await Speech({...})` generates audio and returns a ResolvedElement with `.duration`. */
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

/** Create a `<TalkingHead>` element for lipsync avatar generation. */
export function TalkingHead(
  props: TalkingHeadProps,
): VargElement<"talking-head"> {
  return createElement(
    "talking-head",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create a `<Title>` text overlay element. */
export function Title(props: TitleProps): VargElement<"title"> {
  return createElement(
    "title",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create a `<Subtitle>` text overlay element. */
export function Subtitle(props: SubtitleProps): VargElement<"subtitle"> {
  return createElement(
    "subtitle",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create a `<Music>` element. Awaitable: `await Music({...})` generates audio and returns a ResolvedElement with `.duration`. */
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

/** Create a `<Captions>` element for word-level subtitles burned into the video. */
export function Captions(props: CaptionsProps): VargElement<"captions"> {
  return createElement("captions", props as Record<string, unknown>, undefined);
}

/** Create a `<Slider>` element for horizontal/vertical slide transitions between children. */
export function Slider(props: SliderProps): VargElement<"slider"> {
  return createElement(
    "slider",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create a `<Swipe>` element for swipe-style transitions between children. */
export function Swipe(props: SwipeProps): VargElement<"swipe"> {
  return createElement(
    "swipe",
    props as Record<string, unknown>,
    props.children,
  );
}

/** Create a `<Packshot>` end-card element with logo and call-to-action. */
export function Packshot(props: PackshotProps): VargElement<"packshot"> {
  return createElement("packshot", props as Record<string, unknown>, undefined);
}
