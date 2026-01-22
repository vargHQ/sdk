import { editly } from "../../ai-sdk/providers/editly";
import type {
  Clip,
  ImageOverlayLayer,
  Layer,
  Position,
  TitleLayer,
} from "../../ai-sdk/providers/editly/types";
import type { PackshotProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";

function resolvePosition(pos: Position | undefined): Position {
  return pos ?? "center";
}

export async function renderPackshot(
  element: VargElement<"packshot">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as PackshotProps;
  const duration = props.duration ?? 3;

  const layers: Layer[] = [];

  if (props.background) {
    if (typeof props.background === "string") {
      layers.push({
        type: "fill-color" as const,
        color: props.background,
      });
    } else {
      const bgPath = await renderImage(props.background, ctx);
      layers.push({
        type: "image" as const,
        path: bgPath,
        resizeMode: "cover" as const,
      });
    }
  } else {
    layers.push({
      type: "fill-color" as const,
      color: "#000000",
    });
  }

  if (props.logo) {
    const logoLayer: ImageOverlayLayer = {
      type: "image-overlay",
      path: props.logo,
      position: resolvePosition(props.logoPosition),
      width: props.logoSize ?? "30%",
    };
    layers.push(logoLayer);
  }

  if (props.cta) {
    const ctaLayer: TitleLayer = {
      type: "title",
      text: props.cta,
      textColor: props.ctaColor ?? "white",
      position: resolvePosition(props.ctaPosition ?? "bottom"),
    };
    layers.push(ctaLayer);
  }

  const clip: Clip = {
    layers,
    duration,
  };

  const outPath = `/tmp/varg-packshot-${Date.now()}.mp4`;

  await editly({
    outPath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips: [clip],
  });

  ctx.tempFiles.push(outPath);
  return outPath;
}
