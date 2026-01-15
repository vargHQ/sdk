import type {
  FillColorLayer,
  ImageLayer,
  ImageOverlayLayer,
  Layer,
  LinearGradientLayer,
  Position,
  RadialGradientLayer,
  TitleLayer,
  VideoLayer,
} from "./types";

export interface FilterInput {
  label: string;
  path?: string;
  duration?: number;
}

export interface LayerFilter {
  inputs: FilterInput[];
  filterComplex: string;
  outputLabel: string;
}

export function getVideoFilter(
  layer: VideoLayer,
  index: number,
  width: number,
  height: number,
  isOverlay = false,
): LayerFilter {
  const inputLabel = `${index}:v`;
  const outputLabel = `vout${index}`;
  const filters: string[] = [];

  const layerWidth = layer.width ? Math.round(layer.width * width) : width;
  const layerHeight = layer.height ? Math.round(layer.height * height) : height;

  if (isOverlay) {
    filters.push(
      `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=decrease`,
    );
    filters.push("setsar=1");
    filters.push("fps=30");
    filters.push("settb=1/30");
  } else {
    let scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
    if (layer.resizeMode === "cover") {
      scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    } else if (layer.resizeMode === "stretch") {
      scaleFilter = `scale=${width}:${height}`;
    }

    filters.push(scaleFilter);
    filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
    filters.push("setsar=1");
    filters.push("fps=30");
    filters.push("settb=1/30");
  }

  return {
    inputs: [
      {
        label: inputLabel,
        path: layer.path,
        duration: layer.cutTo ? layer.cutTo - (layer.cutFrom ?? 0) : undefined,
      },
    ],
    filterComplex: `[${inputLabel}]${filters.join(",")}[${outputLabel}]`,
    outputLabel,
  };
}

export function getVideoFilterWithTrim(
  layer: VideoLayer,
  inputIndex: number,
  width: number,
  height: number,
  trimStart: number,
  trimEnd: number,
  outputLabel: string,
  isOverlay = false,
): LayerFilter {
  const inputLabel = `${inputIndex}:v`;
  const filters: string[] = [];

  filters.push(`trim=start=${trimStart}:end=${trimEnd}`);
  filters.push("setpts=PTS-STARTPTS");

  const layerWidth = layer.width ? Math.round(layer.width * width) : width;
  const layerHeight = layer.height ? Math.round(layer.height * height) : height;

  if (isOverlay) {
    filters.push(
      `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=decrease`,
    );
    filters.push("setsar=1");
    filters.push("fps=30");
    filters.push("settb=1/30");
  } else {
    let scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
    if (layer.resizeMode === "cover") {
      scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    } else if (layer.resizeMode === "stretch") {
      scaleFilter = `scale=${width}:${height}`;
    }

    filters.push(scaleFilter);
    filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
    filters.push("setsar=1");
    filters.push("fps=30");
    filters.push("settb=1/30");
  }

  return {
    inputs: [],
    filterComplex: `[${inputLabel}]${filters.join(",")}[${outputLabel}]`,
    outputLabel,
  };
}

export function getOverlayFilter(
  baseLabel: string,
  overlayLabel: string,
  layer: VideoLayer,
  width: number,
  height: number,
  outputLabel: string,
): string {
  const baseX = layer.left !== undefined ? Math.round(layer.left * width) : 0;
  const baseY = layer.top !== undefined ? Math.round(layer.top * height) : 0;

  let xExpr = String(baseX);
  let yExpr = String(baseY);

  if (layer.originX === "center") {
    xExpr = `${baseX}-overlay_w/2`;
  } else if (layer.originX === "right") {
    xExpr = `${baseX}-overlay_w`;
  }

  if (layer.originY === "center") {
    yExpr = `${baseY}-overlay_h/2`;
  } else if (layer.originY === "bottom") {
    yExpr = `${baseY}-overlay_h`;
  }

  return `[${baseLabel}][${overlayLabel}]overlay=${xExpr}:${yExpr}:shortest=1[${outputLabel}]`;
}

export function getImageFilter(
  layer: ImageLayer,
  index: number,
  width: number,
  height: number,
  duration: number,
): LayerFilter {
  const inputLabel = `${index}:v`;
  const outputLabel = `imgout${index}`;
  const filters: string[] = [];

  const zoomDir = layer.zoomDirection ?? "in";
  const zoomAmt = layer.zoomAmount ?? 0.1;
  const totalFrames = Math.ceil(duration * 30);

  // ZOOMPAN IMPLEMENTATION NOTES:
  // 1. MUST upscale to 8000px first - prevents subpixel jitter/shaking during zoom
  // 2. MUST use trunc() for x/y positioning - avoids fractional pixel rounding errors
  // 3. For "contain" mode (default): zoompan at 8000x8000, then scale+pad to preserve aspect ratio
  // 4. For "cover"/"stretch": zoompan directly to output size (fills frame)
  // 5. "left"/"right" pan horizontally while slightly zoomed in (no zoom animation, just pan)
  if (zoomDir && zoomDir !== null) {
    let zoomExpr: string;
    let xExpr: string;
    let yExpr: string;

    if (zoomDir === "left" || zoomDir === "right") {
      // Pan horizontally while zoomed in slightly - creates cinematic pan effect
      // Zoom is constant, x position animates from one side to other
      const zoom = 1 + zoomAmt;
      zoomExpr = String(zoom);
      yExpr = "trunc((ih-ih/zoom)/2)";
      if (zoomDir === "left") {
        // Start right, pan left (x decreases)
        xExpr = `trunc((iw-iw/zoom)*(1-on/${totalFrames}))`;
      } else {
        // Start left, pan right (x increases)
        xExpr = `trunc((iw-iw/zoom)*on/${totalFrames})`;
      }
    } else {
      // in/out: zoom animation, centered
      const startZoom = zoomDir === "in" ? 1 : 1 + zoomAmt;
      const endZoom = zoomDir === "in" ? 1 + zoomAmt : 1;
      zoomExpr = `${startZoom}+(${endZoom}-${startZoom})*on/${totalFrames}`;
      xExpr = "trunc((iw-iw/zoom)/2)";
      yExpr = "trunc((ih-ih/zoom)/2)";
    }

    if (layer.resizeMode === "cover") {
      filters.push(`scale=8000:-1`);
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=30`,
      );
    } else if (layer.resizeMode === "stretch") {
      filters.push(`scale=8000:-1`);
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=30`,
      );
    } else {
      // Default "contain" mode: preserve aspect ratio with letterboxing
      // Zoompan at high res square, then scale down preserving aspect, then pad
      filters.push(`scale=8000:8000:force_original_aspect_ratio=increase`);
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=8000x8000:fps=30`,
      );
      filters.push(
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      );
      filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
    }
  } else {
    filters.push(`loop=loop=-1:size=1:start=0`);
    filters.push(`fps=30`);
    filters.push(`trim=duration=${duration}`);

    let scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
    if (layer.resizeMode === "cover") {
      scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    } else if (layer.resizeMode === "stretch") {
      scaleFilter = `scale=${width}:${height}`;
    }
    filters.push(scaleFilter);
    filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
  }

  filters.push("setsar=1");
  filters.push("settb=1/30");

  return {
    inputs: [{ label: inputLabel, path: layer.path }],
    filterComplex: `[${inputLabel}]${filters.join(",")}[${outputLabel}]`,
    outputLabel,
  };
}

export function getFillColorFilter(
  layer: FillColorLayer,
  index: number,
  width: number,
  height: number,
  duration: number,
): LayerFilter {
  const color = layer.color ?? "#000000";
  const outputLabel = `color${index}`;

  return {
    inputs: [],
    filterComplex: `color=c=${color}:s=${width}x${height}:d=${duration}:r=30[${outputLabel}]`,
    outputLabel,
  };
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `0x${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getGradientFilter(
  layer: RadialGradientLayer | LinearGradientLayer,
  index: number,
  width: number,
  height: number,
  duration: number,
): LayerFilter {
  const colors = layer.colors ?? ["#ff6b6b", "#4ecdc4"];
  const outputLabel = `grad${index}`;

  const c0 = hexToRgb(colors[0]);
  const c1 = hexToRgb(colors[1]);

  if (layer.type === "radial-gradient") {
    return {
      inputs: [],
      filterComplex: `gradients=s=${width}x${height}:c0=${c0}:c1=${c1}:type=radial:d=${duration}:r=30[${outputLabel}]`,
      outputLabel,
    };
  }

  return {
    inputs: [],
    filterComplex: `gradients=s=${width}x${height}:c0=${c0}:c1=${c1}:d=${duration}:r=30[${outputLabel}]`,
    outputLabel,
  };
}

// IMAGE-OVERLAY IMPLEMENTATION NOTES:
// Unlike full-screen image layer, image-overlay:
// 1. Has position/width/height like video overlay
// 2. Supports Ken Burns (zoom/pan) effects
// 3. Gets composited on top of base layers (not as base layer)
// 4. Uses overlay filter for positioning instead of pad filter

function resolvePositionForOverlay(
  position: Position | undefined,
  width: number,
  height: number,
): { x: string; y: string } {
  if (!position) {
    return { x: "(W-w)/2", y: "(H-h)/2" };
  }

  if (typeof position === "object") {
    const baseX = Math.round(position.x * width);
    const baseY = Math.round(position.y * height);

    let xExpr = String(baseX);
    let yExpr = String(baseY);

    if (position.originX === "center") {
      xExpr = `${baseX}-overlay_w/2`;
    } else if (position.originX === "right") {
      xExpr = `${baseX}-overlay_w`;
    }

    if (position.originY === "center") {
      yExpr = `${baseY}-overlay_h/2`;
    } else if (position.originY === "bottom") {
      yExpr = `${baseY}-overlay_h`;
    }

    return { x: xExpr, y: yExpr };
  }

  const posMap: Record<string, { x: string; y: string }> = {
    "top-left": { x: "W*0.1", y: "H*0.1" },
    top: { x: "(W-w)/2", y: "H*0.1" },
    "top-right": { x: "W*0.9-w", y: "H*0.1" },
    "center-left": { x: "W*0.1", y: "(H-h)/2" },
    center: { x: "(W-w)/2", y: "(H-h)/2" },
    "center-right": { x: "W*0.9-w", y: "(H-h)/2" },
    "bottom-left": { x: "W*0.1", y: "H*0.9-h" },
    bottom: { x: "(W-w)/2", y: "H*0.9-h" },
    "bottom-right": { x: "W*0.9-w", y: "H*0.9-h" },
  };

  return posMap[position] ?? { x: "(W-w)/2", y: "(H-h)/2" };
}

export function getImageOverlayFilter(
  layer: ImageOverlayLayer,
  index: number,
  width: number,
  height: number,
  duration: number,
): LayerFilter {
  const inputLabel = `${index}:v`;
  const outputLabel = `imgovout${index}`;
  const filters: string[] = [];

  // -2 preserves aspect ratio and ensures even number (required for most codecs)
  const targetWidth = layer.width
    ? Math.round(layer.width * width)
    : Math.round(width * 0.3);
  const scaleExpr = layer.height
    ? `scale=${targetWidth}:${Math.round(layer.height * height)}`
    : `scale=${targetWidth}:-2`;

  const zoomDir = layer.zoomDirection ?? null;
  const zoomAmt = layer.zoomAmount ?? 0.1;
  const totalFrames = Math.ceil(duration * 30);

  if (zoomDir) {
    let zoomExpr: string;
    let xExpr: string;
    let yExpr: string;

    if (zoomDir === "left" || zoomDir === "right") {
      const zoom = 1 + zoomAmt;
      zoomExpr = String(zoom);
      yExpr = "trunc((ih-ih/zoom)/2)";
      if (zoomDir === "left") {
        xExpr = `trunc((iw-iw/zoom)*(1-on/${totalFrames}))`;
      } else {
        xExpr = `trunc((iw-iw/zoom)*on/${totalFrames})`;
      }
    } else {
      const startZoom = zoomDir === "in" ? 1 : 1 + zoomAmt;
      const endZoom = zoomDir === "in" ? 1 + zoomAmt : 1;
      zoomExpr = `${startZoom}+(${endZoom}-${startZoom})*on/${totalFrames}`;
      xExpr = "trunc((iw-iw/zoom)/2)";
      yExpr = "trunc((ih-ih/zoom)/2)";
    }

    // Upscale, zoompan at high res, then scale to target preserving aspect ratio
    filters.push("scale=4000:-2");
    filters.push(
      `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=4000x4000:fps=30`,
    );
    filters.push(scaleExpr);
  } else {
    filters.push(scaleExpr);
    filters.push("loop=loop=-1:size=1:start=0");
    filters.push("fps=30");
    filters.push(`trim=duration=${duration}`);
  }

  filters.push("setsar=1");
  filters.push("settb=1/30");

  return {
    inputs: [{ label: inputLabel, path: layer.path }],
    filterComplex: `[${inputLabel}]${filters.join(",")}[${outputLabel}]`,
    outputLabel,
  };
}

export function getImageOverlayPositionFilter(
  baseLabel: string,
  overlayLabel: string,
  layer: ImageOverlayLayer,
  width: number,
  height: number,
  outputLabel: string,
): string {
  const { x, y } = resolvePositionForOverlay(layer.position, width, height);
  return `[${baseLabel}][${overlayLabel}]overlay=${x}:${y}:shortest=1[${outputLabel}]`;
}

export function getTitleFilter(
  layer: TitleLayer,
  baseLabel: string,
  width: number,
  height: number,
): string {
  // ffmpeg drawtext escaping: single quotes and colons must be escaped
  const text = layer.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
  const color = layer.textColor ?? "white";
  const fontSize = Math.round(Math.min(width, height) * 0.08);

  let x = "(w-text_w)/2";
  let y = "(h-text_h)/2";

  const pos = layer.position ?? "center";
  if (typeof pos === "string") {
    if (pos.includes("left")) x = "w*0.1";
    if (pos.includes("right")) x = "w*0.9-text_w";
    if (pos.includes("top")) y = "h*0.1";
    if (pos.includes("bottom")) y = "h*0.9-text_h";
  }

  // fontfile: path to .ttf/.otf file (must escape colons for Windows paths)
  // fontFamily: system font name (e.g. "Helvetica Neue Bold") - use this for .ttc collections
  // if both specified, fontfile takes precedence
  const fontFile = layer.fontPath
    ? `:fontfile='${layer.fontPath.replace(/:/g, "\\:")}'`
    : "";
  const fontFamily = layer.fontFamily ? `:font='${layer.fontFamily}'` : "";

  return `[${baseLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}${fontFile}${fontFamily}`;
}

export function processLayer(
  layer: Layer,
  index: number,
  width: number,
  height: number,
  duration: number,
  isOverlay = false,
): LayerFilter | null {
  switch (layer.type) {
    case "video":
      return getVideoFilter(layer, index, width, height, isOverlay);
    case "image":
      return getImageFilter(layer, index, width, height, duration);
    case "fill-color":
    case "pause":
      return getFillColorFilter(
        layer as FillColorLayer,
        index,
        width,
        height,
        duration,
      );
    case "radial-gradient":
    case "linear-gradient":
      return getGradientFilter(
        layer as RadialGradientLayer | LinearGradientLayer,
        index,
        width,
        height,
        duration,
      );
    case "audio":
      return null;
    default:
      return null;
  }
}
