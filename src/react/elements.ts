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
  SplitProps,
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

export function Image(props: ImageProps): VargElement<"image"> {
  return createElement("image", props as Record<string, unknown>, undefined);
}

export function Video(props: VideoProps): VargElement<"video"> {
  return createElement("video", props as Record<string, unknown>, undefined);
}

export function Speech(props: SpeechProps): VargElement<"speech"> {
  return createElement(
    "speech",
    props as Record<string, unknown>,
    props.children,
  );
}

export function TalkingHead(
  props: TalkingHeadProps,
): VargElement<"talking-head"> {
  return createElement(
    "talking-head",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Title(props: TitleProps): VargElement<"title"> {
  return createElement(
    "title",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Subtitle(props: SubtitleProps): VargElement<"subtitle"> {
  return createElement(
    "subtitle",
    props as Record<string, unknown>,
    props.children,
  );
}

export function Music(props: MusicProps): VargElement<"music"> {
  return createElement("music", props as Record<string, unknown>, undefined);
}

export function Captions(props: CaptionsProps): VargElement<"captions"> {
  return createElement("captions", props as Record<string, unknown>, undefined);
}

export function Split(props: SplitProps): VargElement<"split"> {
  return createElement(
    "split",
    props as Record<string, unknown>,
    props.children,
  );
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
