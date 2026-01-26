import type {
  CropPosition,
  FillColorLayer,
  ImageLayer,
  ImageOverlayLayer,
  Layer,
  LinearGradientLayer,
  NewsTitleLayer,
  Position,
  RadialGradientLayer,
  RainbowColorsLayer,
  SlideInTextLayer,
  SubtitleLayer,
  TitleBackgroundLayer,
  TitleLayer,
  VideoLayer,
} from "./types";

function getCropPositionExpr(position: CropPosition | undefined): {
  x: string;
  y: string;
} {
  switch (position) {
    case "top-left":
      return { x: "0", y: "0" };
    case "top":
      return { x: "(iw-ow)/2", y: "0" };
    case "top-right":
      return { x: "iw-ow", y: "0" };
    case "left":
      return { x: "0", y: "(ih-oh)/2" };
    case "right":
      return { x: "iw-ow", y: "(ih-oh)/2" };
    case "bottom-left":
      return { x: "0", y: "ih-oh" };
    case "bottom":
      return { x: "(iw-ow)/2", y: "ih-oh" };
    case "bottom-right":
      return { x: "iw-ow", y: "ih-oh" };
    case "center":
    default:
      return { x: "(iw-ow)/2", y: "(ih-oh)/2" };
  }
}

function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function parseSize(val: number | string | undefined, base: number): number {
  if (val === undefined) return base;
  if (typeof val === "number") return Math.round(val);
  if (val.endsWith("%")) {
    return Math.round((parseFloat(val) / 100) * base);
  }
  if (val.endsWith("px")) {
    return Math.round(parseFloat(val));
  }
  return Math.round(parseFloat(val));
}

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
  clipDuration: number,
  isOverlay = false,
): LayerFilter {
  const inputLabel = `${index}:v`;
  const outputLabel = `vout${index}`;
  const filters: string[] = [];

  const start = layer.cutFrom ?? 0;
  const end = layer.cutTo ?? start + clipDuration;
  filters.push(`trim=start=${start}:end=${end}`);
  filters.push("setpts=PTS-STARTPTS");

  const layerWidth = parseSize(layer.width, width);
  const layerHeight = parseSize(layer.height, height);

  if (isOverlay) {
    filters.push(
      `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=decrease`,
    );
    filters.push("setsar=1");
    filters.push("fps=30");
    filters.push("settb=1/30");
    return {
      inputs: [
        {
          label: inputLabel,
          path: layer.path,
          duration: layer.cutTo
            ? layer.cutTo - (layer.cutFrom ?? 0)
            : undefined,
        },
      ],
      filterComplex: `[${inputLabel}]${filters.join(",")}[${outputLabel}]`,
      outputLabel,
    };
  }

  if (layer.resizeMode === "contain-blur") {
    const baseFilters = filters.join(",");
    const blurLabel = `vblur${index}`;
    const fgLabel = `vfg${index}`;
    const filterComplex = [
      `[${inputLabel}]${baseFilters},split[${blurLabel}][${fgLabel}]`,
      `[${blurLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=20:5,setsar=1[${blurLabel}bg]`,
      `[${fgLabel}]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1[${fgLabel}fg]`,
      `[${blurLabel}bg][${fgLabel}fg]overlay=(W-w)/2:(H-h)/2,fps=30,settb=1/30[${outputLabel}]`,
    ].join(";");
    return {
      inputs: [
        {
          label: inputLabel,
          path: layer.path,
          duration: layer.cutTo
            ? layer.cutTo - (layer.cutFrom ?? 0)
            : undefined,
        },
      ],
      filterComplex,
      outputLabel,
    };
  }

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

  const layerWidth = parseSize(layer.width, width);
  const layerHeight = parseSize(layer.height, height);

  if (isOverlay) {
    let scaleFilter = `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=decrease`;
    if (layer.resizeMode === "cover") {
      const { x, y } = getCropPositionExpr(layer.cropPosition);
      scaleFilter = `scale=${layerWidth}:${layerHeight}:force_original_aspect_ratio=increase,crop=${layerWidth}:${layerHeight}:${x}:${y}`;
    } else if (layer.resizeMode === "stretch") {
      scaleFilter = `scale=${layerWidth}:${layerHeight}`;
    }
    filters.push(scaleFilter);
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
  const baseX = layer.left !== undefined ? parseSize(layer.left, width) : 0;
  const baseY = layer.top !== undefined ? parseSize(layer.top, height) : 0;

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

  const zoomDir =
    layer.zoomDirection === null ? null : (layer.zoomDirection ?? "in");
  const zoomAmt = layer.zoomAmount ?? 0.1;
  const totalFrames = Math.ceil(duration * 30);

  if (zoomDir !== null) {
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

    // DO NOT REMOVE: zoompan needs high resolution to avoid shaking at zoom edges.
    // cover mode: use output aspect ratio (4x) - faster, ~40s for 3 clips at 1080x1920
    // contain mode: use square (maxDim * 4) - slower but handles any input aspect ratio
    // we tried animated crop instead of zoompan but ffmpeg's crop filter doesn't
    // support frame-based expressions properly with looped static images.
    const zoomWidth = width * 4;
    const zoomHeight = height * 4;
    const maxDim = Math.max(width, height);
    const zoomSize = maxDim * 4;

    if (layer.resizeMode === "cover") {
      filters.push(
        `scale=${zoomWidth}:${zoomHeight}:force_original_aspect_ratio=increase`,
      );
      filters.push(`crop=${zoomWidth}:${zoomHeight}`);
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${zoomWidth}x${zoomHeight}:fps=30`,
      );
      filters.push(
        `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      );
      filters.push(`crop=${width}:${height}`);
    } else if (layer.resizeMode === "stretch") {
      filters.push(`scale=${zoomWidth}:${zoomHeight}`);
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=30`,
      );
    } else if (layer.resizeMode === "contain") {
      filters.push(
        `scale=${zoomSize}:${zoomSize}:force_original_aspect_ratio=increase`,
      );
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${zoomSize}x${zoomSize}:fps=30`,
      );
      filters.push(
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      );
      filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
    } else {
      // Default: fast path - zoompan at target resolution directly
      filters.push(
        `scale=${zoomWidth}:${zoomHeight}:force_original_aspect_ratio=increase`,
      );
      filters.push(
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=30`,
      );
    }
  } else {
    filters.push(`loop=loop=-1:size=1:start=0`);
    filters.push(`fps=30`);
    filters.push(`trim=duration=${duration}`);

    if (layer.resizeMode === "contain-blur") {
      const blurLabel = `imgblur${index}`;
      const fgLabel = `imgfg${index}`;
      const baseFilters = filters.join(",");
      const filterComplex = [
        `[${inputLabel}]${baseFilters},split[${blurLabel}][${fgLabel}]`,
        `[${blurLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=20:5,setsar=1[${blurLabel}bg]`,
        `[${fgLabel}]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1[${fgLabel}fg]`,
        `[${blurLabel}bg][${fgLabel}fg]overlay=(W-w)/2:(H-h)/2,settb=1/30[${outputLabel}]`,
      ].join(";");
      return {
        inputs: [{ label: inputLabel, path: layer.path }],
        filterComplex,
        outputLabel,
      };
    }

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
    const baseX = parseSize(position.x, width);
    const baseY = parseSize(position.y, height);

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

  const targetWidth = layer.width
    ? parseSize(layer.width, width)
    : Math.round(width * 0.3);
  const scaleExpr = layer.height
    ? `scale=${targetWidth}:${parseSize(layer.height, height)}`
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

function getEnableExpr(
  start: number | undefined,
  stop: number | undefined,
  clipDuration: number,
): string {
  if (start === undefined && stop === undefined) return "";
  const s = start ?? 0;
  const e = stop ?? clipDuration;
  return `:enable='between(t,${s},${e})'`;
}

export function getTitleFilter(
  layer: TitleLayer,
  baseLabel: string,
  width: number,
  height: number,
  clipDuration?: number,
): string {
  const text = escapeDrawText(layer.text);
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

  const fontFile = layer.fontPath
    ? `:fontfile='${escapeDrawText(layer.fontPath)}'`
    : "";
  const fontFamily = layer.fontFamily ? `:font='${layer.fontFamily}'` : "";
  const enable = getEnableExpr(layer.start, layer.stop, clipDuration ?? 9999);

  return `[${baseLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}${fontFile}${fontFamily}${enable}`;
}

export function getSubtitleFilter(
  layer: SubtitleLayer,
  baseLabel: string,
  width: number,
  height: number,
  clipDuration?: number,
): string {
  const text = escapeDrawText(layer.text);
  const textColor = layer.textColor ?? "white";
  const bgColor = layer.backgroundColor ?? "black@0.7";

  // Auto-size font to fit within 90% of frame width
  const maxFontSize = Math.round(Math.min(width, height) * 0.05);
  const maxTextWidth = width * 0.9;
  // Average char width ≈ fontSize * 0.55 for sans-serif fonts
  const fittedFontSize = Math.floor(maxTextWidth / (layer.text.length * 0.55));
  const fontSize = Math.max(16, Math.min(maxFontSize, fittedFontSize));
  const boxPadding = Math.round(fontSize * 0.4);

  const fontFile = layer.fontPath
    ? `:fontfile='${escapeDrawText(layer.fontPath)}'`
    : "";
  const fontFamily = layer.fontFamily ? `:font='${layer.fontFamily}'` : "";
  const enable = getEnableExpr(layer.start, layer.stop, clipDuration ?? 9999);

  return `[${baseLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=h*0.85-text_h/2:box=1:boxcolor=${bgColor}:boxborderw=${boxPadding}${fontFile}${fontFamily}${enable}`;
}

export function getTitleBackgroundFilter(
  layer: TitleBackgroundLayer,
  index: number,
  width: number,
  height: number,
  duration: number,
): LayerFilter {
  const bg = layer.background ?? {
    type: "fill-color" as const,
    color: "#000000",
  };
  let bgFilter: LayerFilter;

  if (bg.type === "radial-gradient" || bg.type === "linear-gradient") {
    bgFilter = getGradientFilter(bg, index, width, height, duration);
  } else {
    bgFilter = getFillColorFilter(
      bg as FillColorLayer,
      index,
      width,
      height,
      duration,
    );
  }

  const text = escapeDrawText(layer.text);
  const textColor = layer.textColor ?? "white";
  const fontSize = Math.round(Math.min(width, height) * 0.1);

  const fontFile = layer.fontPath
    ? `:fontfile='${escapeDrawText(layer.fontPath)}'`
    : "";
  const fontFamily = layer.fontFamily ? `:font='${layer.fontFamily}'` : "";

  const outputLabel = `titlebg${index}`;
  const drawText = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=(h-text_h)/2${fontFile}${fontFamily}`;

  return {
    inputs: bgFilter.inputs,
    filterComplex: `${bgFilter.filterComplex};[${bgFilter.outputLabel}]${drawText}[${outputLabel}]`,
    outputLabel,
  };
}

export function getRainbowColorsFilter(
  _layer: RainbowColorsLayer,
  index: number,
  width: number,
  height: number,
  duration: number,
): LayerFilter {
  const outputLabel = `rainbow${index}`;
  const fps = 30;

  return {
    inputs: [],
    filterComplex: `color=c=red:s=${width}x${height}:d=${duration}:r=${fps},hue=h=t*60[${outputLabel}]`,
    outputLabel,
  };
}

export function getNewsTitleFilter(
  layer: NewsTitleLayer,
  baseLabel: string,
  width: number,
  height: number,
  clipDuration?: number,
): string {
  const text = escapeDrawText(layer.text);
  const textColor = layer.textColor ?? "white";
  const bgColor = layer.backgroundColor ?? "red";
  const fontSize = Math.round(Math.min(width, height) * 0.05);
  const barHeight = Math.round(fontSize * 2.5);
  const padding = Math.round(fontSize * 0.5);

  const fontFile = layer.fontPath
    ? `:fontfile='${escapeDrawText(layer.fontPath)}'`
    : "";
  const fontFamily = layer.fontFamily ? `:font='${layer.fontFamily}'` : "";
  const enable = getEnableExpr(layer.start, layer.stop, clipDuration ?? 9999);

  const pos = layer.position ?? "bottom";
  const yBar = pos === "top" ? 0 : height - barHeight;
  const yText = pos === "top" ? padding : height - barHeight + padding;

  return `[${baseLabel}]drawbox=x=0:y=${yBar}:w=iw:h=${barHeight}:color=${bgColor}:t=fill${enable},drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${textColor}:x=${padding}:y=${yText}${fontFile}${fontFamily}${enable}`;
}

export function getSlideInTextFilter(
  layer: SlideInTextLayer,
  baseLabel: string,
  width: number,
  height: number,
  duration: number,
): string {
  const text = escapeDrawText(layer.text);
  const textColor = layer.color ?? layer.textColor ?? "white";
  const fontSize = layer.fontSize ?? Math.round(Math.min(width, height) * 0.08);

  const fontFile = layer.fontPath
    ? `:fontfile='${escapeDrawText(layer.fontPath)}'`
    : "";
  const fontFamily = layer.fontFamily ? `:font='${layer.fontFamily}'` : "";
  const enable = getEnableExpr(layer.start, layer.stop, duration);

  const pos = layer.position ?? "center";
  let yExpr = "(h-text_h)/2";
  if (typeof pos === "string") {
    if (pos.includes("top")) yExpr = "h*0.2";
    if (pos.includes("bottom")) yExpr = "h*0.8-text_h";
  }

  const slideInFrames = Math.round(duration * 30 * 0.3);
  const xExpr = `if(lt(t\\,${slideInFrames}/30)\\,-text_w+(w/2+text_w/2)*t/(${slideInFrames}/30)\\,(w-text_w)/2)`;

  return `[${baseLabel}]drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${textColor}:x='${xExpr}':y=${yExpr}${fontFile}${fontFamily}${enable}`;
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
      return getVideoFilter(layer, index, width, height, duration, isOverlay);
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
    case "title-background":
      return getTitleBackgroundFilter(
        layer as TitleBackgroundLayer,
        index,
        width,
        height,
        duration,
      );
    case "rainbow-colors":
      return getRainbowColorsFilter(
        layer as RainbowColorsLayer,
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
