import { editly } from "../../ai-sdk/providers/editly";
import type {
  FFmpegBackend,
  FFmpegOutput,
} from "../../ai-sdk/providers/editly/backends/types";
import type {
  Clip,
  ImageOverlayLayer,
  Layer,
  Position,
  PositionObject,
  SizeValue,
  TitleLayer,
  VideoLayer,
} from "../../ai-sdk/providers/editly/types";
import type { PackshotProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { createBlinkingButton } from "./packshot/blinking-button";
import { renderVideo } from "./video";

/**
 * Resolve an FFmpegOutput to a string path/URL via the backend.
 * Local backend returns local paths; cloud backends upload and return URLs.
 */
async function resolveInputMaybeUpload(
  input: FFmpegOutput,
  backend: FFmpegBackend,
): Promise<string> {
  if (input.type === "url") return input.url;
  return backend.resolvePath(input.path);
}

/**
 * Type guard: returns true if `pos` is a PositionObject ({ x, y }).
 */
function isPositionObject(pos: Position): pos is PositionObject {
  return typeof pos === "object" && pos !== null && "x" in pos && "y" in pos;
}

/**
 * Parse a SizeValue to a normalised 0-1 fraction.
 *
 * - `number`        – treated as a raw pixel value; divided by `total`.
 * - `"50%"`         – percentage string; divided by 100.
 * - `"120px"`       – pixel string; parsed and divided by `total`.
 *
 * Returns `0.5` (centre) when the value cannot be parsed.
 */
function sizeValueToFraction(value: SizeValue, total: number): number {
  if (typeof value === "number") {
    return total > 0 ? value / total : 0.5;
  }
  if (typeof value === "string") {
    if (value.endsWith("%")) {
      const n = parseFloat(value);
      return Number.isFinite(n) ? n / 100 : 0.5;
    }
    if (value.endsWith("px")) {
      const n = parseFloat(value);
      return Number.isFinite(n) && total > 0 ? n / total : 0.5;
    }
  }
  return 0.5;
}

/**
 * Convert a PositionObject to the nearest string Position.
 *
 * The x axis is split into thirds: left (< 0.33), center, right (> 0.67).
 * The y axis is split into thirds: top (< 0.33), center, bottom (> 0.67).
 *
 * `refWidth` / `refHeight` are only needed when the SizeValue is in pixels;
 * when unknown, pass 1 and only percentage / fraction values will resolve
 * correctly.
 */
function positionObjectToString(
  obj: PositionObject,
  refWidth = 1,
  refHeight = 1,
): Exclude<Position, PositionObject> {
  const fx = sizeValueToFraction(obj.x, refWidth);
  const fy = sizeValueToFraction(obj.y, refHeight);

  const col: "left" | "center" | "right" =
    fx < 0.33 ? "left" : fx > 0.67 ? "right" : "center";
  const row: "top" | "center" | "bottom" =
    fy < 0.33 ? "top" : fy > 0.67 ? "bottom" : "center";

  if (row === "center" && col === "center") return "center";
  if (row === "center")
    return `center-${col}` as "center-left" | "center-right";
  if (col === "center") return row; // "top" | "bottom"
  return `${row}-${col}` as
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
}

function resolvePosition(pos: Position | undefined): Position {
  if (pos === undefined) return "center";
  if (isPositionObject(pos)) return positionObjectToString(pos);
  return pos;
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
    } else if (props.background.type === "video") {
      const bgFile = await renderVideo(
        props.background as VargElement<"video">,
        ctx,
      );
      const bgPath = await ctx.backend.resolvePath(bgFile);
      const videoLayer: VideoLayer = {
        type: "video",
        path: bgPath,
        resizeMode: "cover",
      };
      layers.push(videoLayer);
    } else {
      const bgFile = await renderImage(
        props.background as VargElement<"image">,
        ctx,
      );
      const bgPath = await ctx.backend.resolvePath(bgFile);
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
      position: resolvePosition(props.logoPosition ?? "center"),
      width: props.logoSize ?? "40%",
    };
    layers.push(logoLayer);
  }

  // ===== TITLE LAYER =====
  if (props.title) {
    const titleLayer: TitleLayer = {
      type: "title",
      text: props.title,
      textColor: props.titleColor ?? "#FFFFFF",
      position: resolvePosition(props.titlePosition ?? "center"),
    };
    layers.push(titleLayer);
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

  const baseResult = await editly({
    outPath: basePath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips: [clip],
    backend: ctx.backend,
  });

  // ===== BLINKING CTA OVERLAY =====
  if (props.cta && props.blinkCta) {
    const btn = await createBlinkingButton(
      {
        text: props.cta,
        width: ctx.width,
        height: ctx.height,
        duration,
        fps: ctx.fps,
        bgColor: props.ctaColor ?? "#FF6B00",
        textColor: props.ctaTextColor ?? "#FFFFFF",
        blinkFrequency: props.blinkFrequency ?? 0.8,
        position: mapCtaPosition(props.ctaPosition, ctx.height),
        buttonWidth: props.ctaSize?.width,
        buttonHeight: props.ctaSize?.height,
      },
      ctx.backend,
    );

    // Composite button overlay at correct position on base video via backend
    const baseInput = await resolveInputMaybeUpload(
      baseResult.output,
      ctx.backend,
    );
    const btnInput = await resolveInputMaybeUpload(btn.output, ctx.backend);

    const finalPath = `/tmp/varg-packshot-final-${Date.now()}.mp4`;

    const overlayResult = await ctx.backend.run({
      inputs: [baseInput, btnInput],
      filterComplex: `[0:v][1:v]overlay=${btn.x}:${btn.y}:format=auto`,
      outputArgs: [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
      ],
      outputPath: finalPath,
    });

    if (overlayResult.output.type === "file") {
      ctx.tempFiles.push(basePath, overlayResult.output.path);
      return overlayResult.output.path;
    }
    // Cloud backend returns URL
    return overlayResult.output.url;
  }

  if (baseResult.output.type === "url") return baseResult.output.url;
  ctx.tempFiles.push(basePath);
  return basePath;
}

/**
 * Map a Position (string literal **or** PositionObject) to the vertical
 * bucket that the blinking-button renderer understands.
 *
 * When a PositionObject ({ x, y }) is provided the y-coordinate is
 * normalised to a 0-1 fraction and mapped to "top" (< 0.33),
 * "center" (0.33-0.67), or "bottom" (> 0.67).  Pixel values are
 * resolved against `refHeight` (defaults to 1, which means only
 * percentages will convert correctly when the caller does not supply it).
 */
function mapCtaPosition(
  pos: Position | undefined,
  refHeight = 1,
): "top" | "center" | "bottom" {
  if (pos === undefined) return "bottom";

  // Handle PositionObject ({ x, y }) explicitly
  if (isPositionObject(pos)) {
    const fy = sizeValueToFraction(pos.y, refHeight);
    if (fy < 0.33) return "top";
    if (fy > 0.67) return "bottom";
    return "center";
  }

  // String literal positions
  switch (pos) {
    case "top":
    case "top-left":
    case "top-right":
      return "top";
    case "center":
    case "center-left":
    case "center-right":
      return "center";
    default:
      return "bottom";
  }
}
