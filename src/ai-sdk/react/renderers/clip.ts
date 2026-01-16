import type {
  AudioLayer,
  Clip,
  FillColorLayer,
  ImageLayer,
  ImageOverlayLayer,
  Layer,
  VideoLayer,
} from "../../providers/editly/types";
import type {
  AnimateProps,
  ClipProps,
  ImageProps,
  SpeechProps,
  VargElement,
  VargNode,
  VideoProps,
} from "../types";
import { renderAnimate } from "./animate";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderSpeech } from "./speech";
import { renderSubtitle } from "./subtitle";
import { renderTitle } from "./title";
import { renderVideo } from "./video";

type PendingLayer =
  | { type: "sync"; layer: Layer }
  | { type: "async"; promise: Promise<Layer> };

async function renderClipLayers(
  children: VargNode[],
  ctx: RenderContext,
): Promise<Layer[]> {
  const pending: PendingLayer[] = [];

  for (const child of children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const element = child as VargElement;

    switch (element.type) {
      case "image": {
        const props = element.props as ImageProps;
        const hasPosition =
          props.left !== undefined ||
          props.top !== undefined ||
          props.width !== undefined ||
          props.height !== undefined;

        pending.push({
          type: "async",
          promise: renderImage(element as VargElement<"image">, ctx).then(
            (path) =>
              hasPosition
                ? ({
                    type: "image-overlay",
                    path,
                    zoomDirection: props.zoom,
                    width: props.width,
                    height: props.height,
                    position: { x: props.left ?? 0, y: props.top ?? 0 },
                  } as ImageOverlayLayer)
                : ({
                    type: "image",
                    path,
                    resizeMode: props.resize,
                    zoomDirection: props.zoom,
                  } as ImageLayer),
          ),
        });
        break;
      }

      case "video": {
        const props = element.props as VideoProps;
        pending.push({
          type: "async",
          promise: renderVideo(element as VargElement<"video">, ctx).then(
            (path) =>
              ({
                type: "video",
                path,
                resizeMode: props.resize,
                cutFrom: props.cutFrom,
                cutTo: props.cutTo,
                mixVolume: props.keepAudio ? props.volume : 0,
                left: props.left,
                top: props.top,
                width: props.width,
                height: props.height,
              }) as VideoLayer,
          ),
        });
        break;
      }

      case "animate": {
        const props = element.props as AnimateProps;
        pending.push({
          type: "async",
          promise: renderAnimate(element as VargElement<"animate">, ctx).then(
            (path) =>
              ({
                type: "video",
                path,
                left: props.left,
                top: props.top,
                width: props.width,
                height: props.height,
              }) as VideoLayer,
          ),
        });
        break;
      }

      case "title": {
        pending.push({
          type: "sync",
          layer: renderTitle(element as VargElement<"title">),
        });
        break;
      }

      case "subtitle": {
        pending.push({
          type: "sync",
          layer: renderSubtitle(element as VargElement<"subtitle">),
        });
        break;
      }

      case "speech": {
        const props = element.props as SpeechProps;
        pending.push({
          type: "async",
          promise: renderSpeech(element as VargElement<"speech">, ctx).then(
            (result) =>
              ({
                type: "audio",
                path: result.path,
                mixVolume: props.volume ?? 1,
              }) as AudioLayer,
          ),
        });
        break;
      }
    }
  }

  const layers = await Promise.all(
    pending.map((p) => (p.type === "sync" ? p.layer : p.promise)),
  );

  return layers;
}

export async function renderClip(
  element: VargElement<"clip">,
  ctx: RenderContext,
): Promise<Clip> {
  const props = element.props as ClipProps;
  const layers = await renderClipLayers(element.children, ctx);

  const isOverlayVideo = (l: Layer) =>
    l.type === "video" &&
    ((l as VideoLayer).left !== undefined ||
      (l as VideoLayer).top !== undefined ||
      (l as VideoLayer).width !== undefined ||
      (l as VideoLayer).height !== undefined);

  const hasBaseLayer = layers.some(
    (l) =>
      l.type === "image" ||
      l.type === "fill-color" ||
      (l.type === "video" && !isOverlayVideo(l)),
  );

  if (!hasBaseLayer && layers.length > 0) {
    layers.unshift({ type: "fill-color", color: "#000000" } as FillColorLayer);
  }

  return {
    layers,
    duration: typeof props.duration === "number" ? props.duration : undefined,
    transition: props.transition ?? null,
  };
}
