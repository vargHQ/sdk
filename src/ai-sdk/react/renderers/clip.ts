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
import { renderTitle } from "./title";
import { renderVideo } from "./video";

async function renderClipLayers(
  children: VargNode[],
  ctx: RenderContext,
): Promise<Layer[]> {
  const layers: Layer[] = [];

  for (const child of children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const element = child as VargElement;

    switch (element.type) {
      case "image": {
        const path = await renderImage(element as VargElement<"image">, ctx);
        const props = element.props as ImageProps;
        const hasPosition =
          props.left !== undefined ||
          props.top !== undefined ||
          props.width !== undefined ||
          props.height !== undefined;

        if (hasPosition) {
          layers.push({
            type: "image-overlay",
            path,
            zoomDirection: props.zoom,
            width: props.width,
            height: props.height,
            position: { x: props.left ?? 0, y: props.top ?? 0 },
          } as ImageOverlayLayer);
        } else {
          layers.push({
            type: "image",
            path,
            resizeMode: props.resize,
            zoomDirection: props.zoom,
          } as ImageLayer);
        }
        break;
      }

      case "video": {
        const path = await renderVideo(element as VargElement<"video">, ctx);
        const props = element.props as VideoProps;
        layers.push({
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
        } as VideoLayer);
        break;
      }

      case "animate": {
        const path = await renderAnimate(
          element as VargElement<"animate">,
          ctx,
        );
        const props = element.props as AnimateProps;
        layers.push({
          type: "video",
          path,
          left: props.left,
          top: props.top,
          width: props.width,
          height: props.height,
        } as VideoLayer);
        break;
      }

      case "title": {
        layers.push(renderTitle(element as VargElement<"title">));
        break;
      }

      case "speech": {
        const result = await renderSpeech(
          element as VargElement<"speech">,
          ctx,
        );
        const props = element.props as SpeechProps;
        layers.push({
          type: "audio",
          path: result.path,
          mixVolume: props.volume ?? 1,
        } as AudioLayer);
        break;
      }
    }
  }

  return layers;
}

export async function renderClip(
  element: VargElement<"clip">,
  ctx: RenderContext,
): Promise<Clip> {
  const props = element.props as ClipProps;
  const layers = await renderClipLayers(element.children, ctx);

  const hasBaseLayer = layers.some(
    (l) => l.type === "image" || l.type === "video" || l.type === "fill-color",
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
