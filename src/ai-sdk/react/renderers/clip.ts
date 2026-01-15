import type {
  AudioLayer,
  Clip,
  ImageLayer,
  Layer,
  VideoLayer,
} from "../../providers/editly/types";
import type {
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
        layers.push({
          type: "image",
          path,
          resizeMode: props.resize,
          zoomDirection: props.zoom,
        } as ImageLayer);
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
        } as VideoLayer);
        break;
      }

      case "animate": {
        const path = await renderAnimate(
          element as VargElement<"animate">,
          ctx,
        );
        layers.push({
          type: "video",
          path,
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

  return {
    layers,
    duration: typeof props.duration === "number" ? props.duration : undefined,
    transition: props.transition ?? null,
  };
}
