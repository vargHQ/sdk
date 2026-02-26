import { depsToKey } from "../../ai-sdk/cache";
import type {
  FFmpegBackend,
  FFmpegInput,
  FFmpegOutput,
} from "../../ai-sdk/providers/editly/backends/types";
import {
  escapeDrawText,
  parseSize,
  resolvePositionForOverlay,
} from "../../ai-sdk/providers/editly/layers";
import type {
  Position,
  PositionObject,
  SizeValue,
} from "../../ai-sdk/providers/editly/types";
import type { PackshotProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import {
  type BlinkingButtonPngs,
  buildBlinkingButtonFilter,
  even,
  getButtonYPosition,
  renderBlinkingButtonPngs,
} from "./packshot/blinking-button";

// ─── Position helpers ────────────────────────────────────────────────────────

/**
 * Type guard: returns true if `pos` is a PositionObject ({ x, y }).
 */
function isPositionObject(pos: Position): pos is PositionObject {
  return typeof pos === "object" && pos !== null && "x" in pos && "y" in pos;
}

/**
 * Parse a SizeValue to a normalised 0-1 fraction.
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
  if (col === "center") return row;
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

function mapCtaPosition(
  pos: Position | undefined,
  refHeight = 1,
): "top" | "center" | "bottom" {
  if (pos === undefined) return "bottom";
  if (isPositionObject(pos)) {
    const fy = sizeValueToFraction(pos.y, refHeight);
    if (fy < 0.33) return "top";
    if (fy > 0.67) return "bottom";
    return "center";
  }
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

// ─── Cache key ───────────────────────────────────────────────────────────────

function computePackshotCacheKey(
  props: PackshotProps,
  width: number,
  height: number,
  fps: number,
): string {
  // Background key: color string, or the image element's src URL
  let bgKey = "#000000";
  if (props.background) {
    if (typeof props.background === "string") {
      bgKey = props.background;
    } else {
      // Image element — use the src prop for cache key
      const imgProps = props.background.props as Record<string, unknown>;
      bgKey = `img:${imgProps.src ?? imgProps.prompt ?? JSON.stringify(imgProps)}`;
    }
  }

  const deps = [
    "packshot",
    bgKey,
    props.logo ?? "",
    String(resolvePosition(props.logoPosition ?? "center")),
    String(props.logoSize ?? "40%"),
    props.title ?? "",
    props.titleColor ?? "#FFFFFF",
    String(resolvePosition(props.titlePosition ?? "center")),
    props.cta ?? "",
    props.ctaColor ?? "#FF6B00",
    props.ctaTextColor ?? "#FFFFFF",
    String(props.blinkCta ?? false),
    String(props.blinkFrequency ?? 0.8),
    String(resolvePosition(props.ctaPosition ?? "bottom")),
    props.ctaSize ? `${props.ctaSize.width}x${props.ctaSize.height}` : "",
    String(props.duration ?? 3),
    String(width),
    String(height),
    String(fps),
  ];

  return depsToKey("packshot", deps);
}

// ─── Unified filter builder ──────────────────────────────────────────────────

interface PackshotFilterGraph {
  inputs: FFmpegInput[];
  filterComplex: string;
  outputArgs: string[];
}

/**
 * Build a single FFmpeg filter_complex that produces the complete packshot video.
 *
 * Merges what was previously 3 separate backend.run() calls into one:
 * 1. Background (fill-color or image) + logo overlay + title drawtext
 * 2. Blinking button animation (if enabled)
 * 3. Final composite of button over base
 */
function buildPackshotFilter(opts: {
  width: number;
  height: number;
  fps: number;
  duration: number;
  // Background
  bgType: "fill-color" | "image";
  bgColorOrPath: string; // hex color or resolved path/URL
  // Logo (optional)
  logoPath?: string;
  logoPosition: Position;
  logoSize: SizeValue;
  // Title (optional)
  titleText?: string;
  titleColor: string;
  titlePosition: Position;
  // Static CTA (optional, mutually exclusive with blinkCta)
  staticCtaText?: string;
  staticCtaColor?: string;
  staticCtaPosition?: Position;
  // Blinking CTA (optional)
  blinkCta?: {
    pngs: BlinkingButtonPngs;
    btnPngPath: string; // resolved path/URL
    glowPngPath: string; // resolved path/URL
    blinkFrequency: number;
    position: "top" | "center" | "bottom";
  };
}): PackshotFilterGraph {
  const { width, height, fps, duration } = opts;
  const filters: string[] = [];
  const inputs: FFmpegInput[] = [];
  let inputIdx = 0;
  let currentLabel: string;

  // ── Background ─────────────────────────────────────────────────────────────

  if (opts.bgType === "fill-color") {
    const bgLabel = "bg0";
    filters.push(
      `color=c=${opts.bgColorOrPath}:s=${width}x${height}:d=${duration}:r=${fps}[${bgLabel}]`,
    );
    currentLabel = bgLabel;
  } else {
    // Image background with cover mode
    const bgLabel = "bg0";
    inputs.push(opts.bgColorOrPath); // plain string = file path/URL
    filters.push(
      `[${inputIdx}:v]loop=loop=-1:size=1:start=0,fps=${fps},trim=duration=${duration},` +
        `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},setsar=1,settb=1/${fps}[${bgLabel}]`,
    );
    inputIdx++;
    currentLabel = bgLabel;
  }

  // ── Logo overlay ───────────────────────────────────────────────────────────

  if (opts.logoPath) {
    const logoInputIdx = inputIdx;
    inputs.push(opts.logoPath);
    inputIdx++;

    const targetWidth = parseSize(opts.logoSize, width);
    const logoScaleLabel = `logo_s`;
    filters.push(
      `[${logoInputIdx}:v]scale=${targetWidth}:-2,loop=loop=-1:size=1:start=0,fps=${fps},` +
        `trim=duration=${duration},setsar=1,settb=1/${fps}[${logoScaleLabel}]`,
    );

    const resolvedPos = resolvePosition(opts.logoPosition);
    const { x, y } = resolvePositionForOverlay(resolvedPos, width, height);
    const logoOutLabel = "logo_out";
    filters.push(
      `[${currentLabel}][${logoScaleLabel}]overlay=${x}:${y}:shortest=1[${logoOutLabel}]`,
    );
    currentLabel = logoOutLabel;
  }

  // ── Title drawtext ─────────────────────────────────────────────────────────

  if (opts.titleText) {
    const text = escapeDrawText(opts.titleText);
    const color = opts.titleColor;

    const maxFontSize = Math.round(Math.min(width, height) * 0.08);
    const maxTextWidth = width * 0.9;
    const fittedFontSize = Math.floor(
      maxTextWidth / (opts.titleText.length * 0.55),
    );
    const fontSize = Math.max(16, Math.min(maxFontSize, fittedFontSize));

    let x = "(w-text_w)/2";
    let y = "(h-text_h)/2";

    const pos = resolvePosition(opts.titlePosition);
    if (typeof pos === "string") {
      if (pos.includes("left")) x = "w*0.1";
      if (pos.includes("right")) x = "w*0.9-text_w";
      if (pos.includes("top")) y = "h*0.1";
      if (pos.includes("bottom")) y = "h*0.9-text_h";
    }

    const titleOutLabel = "title_out";
    filters.push(
      `[${currentLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}[${titleOutLabel}]`,
    );
    currentLabel = titleOutLabel;
  }

  // ── Static CTA drawtext (non-blinking) ─────────────────────────────────────

  if (opts.staticCtaText) {
    const text = escapeDrawText(opts.staticCtaText);
    const color = opts.staticCtaColor ?? "white";

    const maxFontSize = Math.round(Math.min(width, height) * 0.08);
    const maxTextWidth = width * 0.9;
    const fittedFontSize = Math.floor(
      maxTextWidth / (opts.staticCtaText.length * 0.55),
    );
    const fontSize = Math.max(16, Math.min(maxFontSize, fittedFontSize));

    let x = "(w-text_w)/2";
    let y = "(h-text_h)/2";

    const pos = resolvePosition(opts.staticCtaPosition ?? "bottom");
    if (typeof pos === "string") {
      if (pos.includes("left")) x = "w*0.1";
      if (pos.includes("right")) x = "w*0.9-text_w";
      if (pos.includes("top")) y = "h*0.1";
      if (pos.includes("bottom")) y = "h*0.9-text_h";
    }

    const ctaOutLabel = "cta_out";
    filters.push(
      `[${currentLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}[${ctaOutLabel}]`,
    );
    currentLabel = ctaOutLabel;
  }

  // ── Blinking CTA overlay ───────────────────────────────────────────────────

  if (opts.blinkCta) {
    const { pngs, btnPngPath, glowPngPath, blinkFrequency, position } =
      opts.blinkCta;

    const btnInputIdx = inputIdx;
    inputs.push({ path: btnPngPath, options: ["-loop", "1"] });
    inputIdx++;

    const glowInputIdx = inputIdx;
    inputs.push({ path: glowPngPath, options: ["-loop", "1"] });
    inputIdx++;

    const btnFilter = buildBlinkingButtonFilter(
      btnInputIdx,
      glowInputIdx,
      pngs,
      { duration, fps, blinkFrequency },
    );

    filters.push(...btnFilter.filters);

    // Overlay the animated button onto the base at the correct position
    const btnY = getButtonYPosition(position, height, pngs.canvasHeight);
    const btnX = Math.floor((width - pngs.canvasWidth) / 2);

    const finalLabel = "final";
    filters.push(
      `[${currentLabel}][${btnFilter.outputLabel}]overlay=${btnX}:${btnY}:format=auto[${finalLabel}]`,
    );
    currentLabel = finalLabel;
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  const outputArgs = [
    "-map",
    `[${currentLabel}]`,
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  return {
    inputs,
    filterComplex: filters.join(";"),
    outputArgs,
  };
}

// ─── Main render function ────────────────────────────────────────────────────

export async function renderPackshot(
  element: VargElement<"packshot">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as PackshotProps;
  const duration = props.duration ?? 3;

  // ── Check cache ────────────────────────────────────────────────────────────

  const cacheKey = computePackshotCacheKey(
    props,
    ctx.width,
    ctx.height,
    ctx.fps,
  );

  if (ctx.cache) {
    const cached = await ctx.cache.get(cacheKey);
    if (cached) {
      const { url } = cached as { url: string; mediaType: string };
      return url;
    }
  }

  // ── Resolve background ─────────────────────────────────────────────────────

  let bgType: "fill-color" | "image" = "fill-color";
  let bgColorOrPath = "#000000";

  if (props.background) {
    if (typeof props.background === "string") {
      bgType = "fill-color";
      bgColorOrPath = props.background;
    } else {
      bgType = "image";
      const bgFile = await renderImage(props.background, ctx);
      bgColorOrPath = await ctx.backend.resolvePath(bgFile);
    }
  }

  // ── Resolve logo ───────────────────────────────────────────────────────────

  let logoPath: string | undefined;
  if (props.logo) {
    logoPath = await ctx.backend.resolvePath(props.logo);
  }

  // ── Render blinking button PNGs ────────────────────────────────────────────

  let blinkCtaOpts:
    | {
        pngs: BlinkingButtonPngs;
        btnPngPath: string;
        glowPngPath: string;
        blinkFrequency: number;
        position: "top" | "center" | "bottom";
      }
    | undefined;

  if (props.cta && props.blinkCta) {
    const pngs = await renderBlinkingButtonPngs({
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
    });

    // Upload PNGs for cloud backends
    const btnPngPath = await ctx.backend.resolvePath(pngs.btnPngPath);
    const glowPngPath = await ctx.backend.resolvePath(pngs.glowPngPath);

    blinkCtaOpts = {
      pngs,
      btnPngPath,
      glowPngPath,
      blinkFrequency: props.blinkFrequency ?? 0.8,
      position: mapCtaPosition(props.ctaPosition, ctx.height),
    };
  }

  // ── Build unified filter graph ─────────────────────────────────────────────

  const graph = buildPackshotFilter({
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    duration,
    bgType,
    bgColorOrPath,
    logoPath,
    logoPosition: props.logoPosition ?? "center",
    logoSize: props.logoSize ?? "40%",
    titleText: props.title,
    titleColor: props.titleColor ?? "#FFFFFF",
    titlePosition: props.titlePosition ?? "center",
    staticCtaText: props.cta && !props.blinkCta ? props.cta : undefined,
    staticCtaColor:
      props.cta && !props.blinkCta ? (props.ctaColor ?? "white") : undefined,
    staticCtaPosition:
      props.cta && !props.blinkCta
        ? resolvePosition(props.ctaPosition ?? "bottom")
        : undefined,
    blinkCta: blinkCtaOpts,
  });

  // ── Execute single backend.run() ───────────────────────────────────────────

  const outputPath = `/tmp/varg-packshot-${Date.now()}.mp4`;

  const result = await ctx.backend.run({
    inputs: graph.inputs,
    filterComplex: graph.filterComplex,
    outputArgs: graph.outputArgs,
    outputPath,
  });

  // ── Cache the result ───────────────────────────────────────────────────────

  const outputUrl =
    result.output.type === "url" ? result.output.url : result.output.path;

  if (ctx.cache) {
    await ctx.cache.set(cacheKey, {
      url: outputUrl,
      mediaType: "video/mp4",
    });
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  if (result.output.type === "file") {
    ctx.tempFiles.push(result.output.path);
    return result.output.path;
  }

  return result.output.url;
}
