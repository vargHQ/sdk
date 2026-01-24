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
import { createBlinkingButton } from "./packshot/blinking-button";

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

  // ===== BACKGROUND LAYER =====
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

  // ===== LOGO LAYER =====
  if (props.logo) {
    const logoLayer: ImageOverlayLayer = {
      type: "image-overlay",
      path: props.logo,
      position: resolvePosition(props.logoPosition),
      width: props.logoSize ?? "30%",
    };
    layers.push(logoLayer);
  }

  // ===== STATIC CTA (non-blinking) =====
  if (props.cta && !props.blinkCta) {
    const ctaLayer: TitleLayer = {
      type: "title",
      text: props.cta,
      textColor: props.ctaColor ?? "white",
      position: resolvePosition(props.ctaPosition ?? "bottom"),
    };
    layers.push(ctaLayer);
  }

  // Create base packshot video
  const clip: Clip = {
    layers,
    duration,
  };

  const basePath = `/tmp/varg-packshot-${Date.now()}.mp4`;

  await editly({
    outPath: basePath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips: [clip],
  });

  // ===== BLINKING CTA OVERLAY =====
  if (props.cta && props.blinkCta) {
    // Create animated button with Sharp (matches Python SDK quality)
    const btnPath = await createBlinkingButton({
      text: props.cta,
      width: ctx.width,
      height: ctx.height,
      duration,
      fps: ctx.fps,
      bgColor: props.ctaColor ?? "#FF6B00",
      textColor: props.ctaTextColor ?? "#FFFFFF",
      blinkFrequency: props.blinkFrequency ?? 0.8,
      position: mapCtaPosition(props.ctaPosition),
      buttonWidth: props.ctaSize?.width,
      buttonHeight: props.ctaSize?.height,
    });

    // Composite button on top of base video
    const finalPath = `/tmp/varg-packshot-final-${Date.now()}.mp4`;
    const { $ } = await import("bun");

    // Overlay the blinking button (with alpha) on the packshot
    await $`ffmpeg -y \
      -i ${basePath} \
      -i ${btnPath} \
      -filter_complex "[0:v][1:v]overlay=0:0:format=auto" \
      -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
      ${finalPath}`.quiet();

    ctx.tempFiles.push(basePath, btnPath);
    return finalPath;
  }

  ctx.tempFiles.push(basePath);
  return basePath;
}

/**
 * Map Position type to blinking button position
 */
function mapCtaPosition(
  pos: Position | undefined,
): "top" | "center" | "bottom" {
  switch (pos) {
    case "top":
    case "top-left":
    case "top-right":
      return "top";
    case "center":
    case "center-left":
    case "center-right":
      return "center";
    case "bottom":
    case "bottom-left":
    case "bottom-right":
    default:
      return "bottom";
  }
}
