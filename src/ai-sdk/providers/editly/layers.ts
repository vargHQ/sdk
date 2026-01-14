import type {
  FillColorLayer,
  ImageLayer,
  Layer,
  LinearGradientLayer,
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

export function getOverlayFilter(
  baseLabel: string,
  overlayLabel: string,
  layer: VideoLayer,
  width: number,
  height: number,
  outputLabel: string,
): string {
  const x = layer.left !== undefined ? Math.round(layer.left * width) : 0;
  const y = layer.top !== undefined ? Math.round(layer.top * height) : 0;

  return `[${baseLabel}][${overlayLabel}]overlay=${x}:${y}:shortest=1[${outputLabel}]`;
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

  // zoompan takes a single image and produces video frames
  // upscale first to prevent subpixel jitter from rounding errors
  if (zoomDir && zoomDir !== null) {
    const startZoom = zoomDir === "in" ? 1 : 1 + zoomAmt;
    const endZoom = zoomDir === "in" ? 1 + zoomAmt : 1;
    filters.push(`scale=8000:-1`);
    filters.push(
      `zoompan=z='${startZoom}+(${endZoom}-${startZoom})*on/${totalFrames}':x='trunc((iw-iw/zoom)/2)':y='trunc((ih-ih/zoom)/2)':d=${totalFrames}:s=${width}x${height}:fps=30`,
    );
  } else {
    // no zoom - use loop to create video from image
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

export function getTitleFilter(
  layer: TitleLayer,
  baseLabel: string,
  width: number,
  height: number,
): string {
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

  return `[${baseLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}`;
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
