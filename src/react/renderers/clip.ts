import type {
  AudioLayer,
  Clip,
  FillColorLayer,
  ImageLayer,
  ImageOverlayLayer,
  Layer,
  VideoLayer,
} from "../../ai-sdk/providers/editly/types";
import { ResolvedElement } from "../resolved-element";
import type {
  ClipProps,
  ImageProps,
  MusicProps,
  OverlayProps,
  SpeechProps,
  VargElement,
  VargNode,
  VideoProps,
} from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderMusic } from "./music";
import { renderPackshot } from "./packshot";
import { renderSlider } from "./slider";
import { renderSpeech } from "./speech";
import { renderSubtitle } from "./subtitle";
import { renderSwipe } from "./swipe";
import { renderTalkingHead } from "./talking-head";
import { renderTitle } from "./title";
import { resolvePath } from "./utils";
import { renderVideo } from "./video";

type PendingLayer =
  | { type: "sync"; layer: Layer }
  | { type: "async"; promise: Promise<Layer> };

interface ClipLayerOptions {
  cutFrom?: number;
  cutTo?: number;
}

async function renderClipLayers(
  children: VargNode[],
  ctx: RenderContext,
  clipOptions?: ClipLayerOptions,
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
          promise: renderImage(element as VargElement<"image">, ctx)
            .then((file) => ctx.backend.resolvePath(file))
            .then((path) =>
              hasPosition
                ? ({
                    type: "image-overlay",
                    path,
                    zoomDirection: props.zoom,
                    width: props.width,
                    height: props.height,
                    position: { x: props.left ?? 0, y: props.top ?? 0 },
                    resizeMode: props.resize,
                    cropPosition: props.cropPosition,
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
            async (file) => {
              const path = await ctx.backend.resolvePath(file);
              return {
                type: "video",
                path,
                sourceDuration: file.duration,
                resizeMode: props.resize,
                cropPosition: props.cropPosition,
                cutFrom: props.cutFrom ?? clipOptions?.cutFrom,
                cutTo: props.cutTo ?? clipOptions?.cutTo,
                mixVolume: props.keepAudio ? (props.volume ?? 1) : 0,
                left: props.left,
                top: props.top,
                width: props.width,
                height: props.height,
              } as VideoLayer;
            },
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
        const resolveFile =
          element instanceof ResolvedElement
            ? Promise.resolve(element.meta.file)
            : renderSpeech(element as VargElement<"speech">, ctx);
        pending.push({
          type: "async",
          promise: resolveFile
            .then((file) => ctx.backend.resolvePath(file))
            .then(
              (path) =>
                ({
                  type: "audio",
                  path,
                  mixVolume: props.volume ?? 1,
                }) as AudioLayer,
            ),
        });
        break;
      }

      case "talking-head": {
        pending.push({
          type: "async",
          promise: renderTalkingHead(
            element as VargElement<"talking-head">,
            ctx,
          ).then(async (file) => {
            const path = await ctx.backend.resolvePath(file);
            return {
              type: "video",
              path,
              sourceDuration: file.duration,
              resizeMode: "cover",
              mixVolume: 1,
            } as VideoLayer;
          }),
        });
        break;
      }

      case "music": {
        const props = element.props as MusicProps;
        pending.push({
          type: "async",
          promise: (async () => {
            let path: string;
            if (props.src) {
              path = resolvePath(props.src);
            } else if (props.prompt) {
              const file = await renderMusic(
                element as VargElement<"music">,
                ctx,
              );
              path = await ctx.backend.resolvePath(file);
            } else {
              throw new Error("Music requires either src or prompt");
            }
            return {
              type: "audio",
              path,
              mixVolume: props.volume ?? 1,
              cutFrom: props.cutFrom,
              cutTo: props.cutTo,
            } as AudioLayer;
          })(),
        });
        break;
      }

      case "slider": {
        pending.push({
          type: "async",
          promise: renderSlider(element as VargElement<"slider">, ctx).then(
            (path) =>
              ({
                type: "video",
                path,
              }) as VideoLayer,
          ),
        });
        break;
      }

      case "swipe": {
        pending.push({
          type: "async",
          promise: renderSwipe(element as VargElement<"swipe">, ctx).then(
            (path) =>
              ({
                type: "video",
                path,
              }) as VideoLayer,
          ),
        });
        break;
      }

      case "packshot": {
        pending.push({
          type: "async",
          promise: renderPackshot(element as VargElement<"packshot">, ctx).then(
            (path) =>
              ({
                type: "video",
                path,
              }) as VideoLayer,
          ),
        });
        break;
      }

      case "clip": {
        console.warn(
          "[varg] Warning: nested <Clip> found inside a leaf clip's layers. " +
            "Nested clips should be handled by the flattenClip() logic in render.ts. " +
            "This clip will be ignored.",
        );
        break;
      }

      case "overlay": {
        const overlayProps = element.props as OverlayProps;
        for (const overlayChild of element.children) {
          if (
            !overlayChild ||
            typeof overlayChild !== "object" ||
            !("type" in overlayChild)
          )
            continue;
          const overlayChildElement = overlayChild as VargElement;

          if (overlayChildElement.type === "image") {
            const hasPosition =
              overlayProps.left !== undefined ||
              overlayProps.top !== undefined ||
              overlayProps.width !== undefined ||
              overlayProps.height !== undefined;

            pending.push({
              type: "async",
              promise: renderImage(
                overlayChildElement as VargElement<"image">,
                ctx,
              )
                .then((file) => ctx.backend.resolvePath(file))
                .then((path) =>
                  hasPosition
                    ? ({
                        type: "image-overlay",
                        path,
                        width: overlayProps.width,
                        height: overlayProps.height,
                        position: {
                          x: overlayProps.left ?? 0,
                          y: overlayProps.top ?? 0,
                        },
                        start: overlayProps.start,
                        stop: overlayProps.end,
                      } as ImageOverlayLayer)
                    : ({
                        type: "image",
                        path,
                        start: overlayProps.start,
                        stop: overlayProps.end,
                      } as ImageLayer),
                ),
            });
          } else if (overlayChildElement.type === "video") {
            pending.push({
              type: "async",
              promise: renderVideo(
                overlayChildElement as VargElement<"video">,
                ctx,
              )
                .then((file) => ctx.backend.resolvePath(file))
                .then(
                  (path) =>
                    ({
                      type: "video",
                      path,
                      mixVolume: overlayProps.keepAudio
                        ? (overlayProps.volume ?? 1)
                        : 0,
                      left: overlayProps.left,
                      top: overlayProps.top,
                      width: overlayProps.width,
                      height: overlayProps.height,
                      start: overlayProps.start,
                      stop: overlayProps.end,
                    }) as VideoLayer,
                ),
            });
          }
        }
        break;
      }
    }
  }

  const layerResults = await Promise.allSettled(
    pending.map((p) =>
      p.type === "sync" ? Promise.resolve(p.layer) : p.promise,
    ),
  );

  const failures = layerResults
    .map((r, i) =>
      r.status === "rejected" ? { index: i, reason: r.reason } : null,
    )
    .filter(Boolean) as { index: number; reason: Error }[];

  if (failures.length > 0) {
    if (failures.length === 1 && failures[0]) {
      throw failures[0].reason;
    }
    const errors = failures
      .map((f) => f.reason?.message || "Unknown error")
      .join("; ");
    throw new Error(
      `${failures.length} of ${layerResults.length} layers failed: ${errors}`,
    );
  }

  return layerResults.map((r) => (r as PromiseFulfilledResult<Layer>).value);
}

export async function renderClip(
  element: VargElement<"clip">,
  ctx: RenderContext,
): Promise<Clip> {
  const props = element.props as ClipProps;
  const layers = await renderClipLayers(element.children, ctx, {
    cutFrom: props.cutFrom,
    cutTo: props.cutTo,
  });

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
