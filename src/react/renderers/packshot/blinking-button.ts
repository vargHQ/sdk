import path from "node:path";
import sharp from "sharp";
import type {
  FFmpegBackend,
  FFmpegOutput,
} from "../../../ai-sdk/providers/editly/backends/types";

export interface BlinkingButtonOptions {
  text: string;
  width: number; // Video frame width
  height: number; // Video frame height
  duration: number;
  fps: number;
  bgColor: string; // Hex color like "#FF6B00"
  textColor: string; // Hex color like "#FFFFFF"
  blinkFrequency?: number; // Seconds per cycle (default: 0.8)
  position?: "top" | "center" | "bottom"; // Vertical position
  buttonWidth?: number; // Button width in pixels
  buttonHeight?: number; // Button height in pixels
}

export interface BlinkingButtonResult {
  /** Output video — local file path or cloud URL */
  output: FFmpegOutput;
  /** X offset for overlaying on the full video frame */
  x: number;
  /** Y offset for overlaying on the full video frame */
  y: number;
  /** Canvas width of the output video */
  canvasWidth: number;
  /** Canvas height of the output video */
  canvasHeight: number;
}

/** Result of rendering the blinking button PNGs (Sharp only, no backend). */
export interface BlinkingButtonPngs {
  /** Path to the native-size button PNG (with alpha) */
  btnPngPath: string;
  /** Path to the glow PNG (canvas-size, 60% alpha baked in) */
  glowPngPath: string;
  /** Native button width (even) */
  btnNativeW: number;
  /** Native button height (even) */
  btnNativeH: number;
  /** Canvas width (even, includes padding for max scale + glow) */
  canvasWidth: number;
  /** Canvas height (even) */
  canvasHeight: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 255, g: 107, b: 0 };
  return {
    r: parseInt(result[1] as string, 16),
    g: parseInt(result[2] as string, 16),
    b: parseInt(result[3] as string, 16),
  };
}

function clamp(value: number, max = 255): number {
  return Math.min(Math.floor(value), max);
}

export function createButtonSvg(
  width: number,
  height: number,
  radius: number,
  topColor: { r: number; g: number; b: number },
  bottomColor: { r: number; g: number; b: number },
): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="btnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(${topColor.r},${topColor.g},${topColor.b})" />
      <stop offset="100%" style="stop-color:rgb(${bottomColor.r},${bottomColor.g},${bottomColor.b})" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="url(#btnGrad)" />
</svg>`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getButtonYPosition(
  position: "top" | "center" | "bottom",
  videoHeight: number,
  buttonHeight: number,
): number {
  switch (position) {
    case "top":
      return Math.floor(videoHeight * 0.15);
    case "center":
      return Math.floor((videoHeight - buttonHeight) / 2);
    default:
      return Math.floor(videoHeight * 0.78 - buttonHeight / 2);
  }
}

/** Ensure even dimension for ffmpeg */
export function even(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Elastic ease oscillator as an ffmpeg expression.
 * Period P seconds, using time variable `tv` ("t" for scale/eq, "T" for geq).
 * Returns 0 -> 1.15 (overshoot) -> 1.0 (settle) -> 0 (fall) per cycle.
 */
export function oscExpr(tv: string, P: number): string {
  const ph = `(mod(${tv},${P})/${P})`;
  return `if(lt(${ph},0.25),sin(${ph}/0.25*PI/2)*1.15,if(lt(${ph},0.4),1.15-0.15*(${ph}-0.25)/0.15,cos((${ph}-0.4)/0.6*PI/2)))`;
}

/**
 * Resolve a local file path to a string path/URL via the backend.
 * Local backend: returns the path as-is.
 * Cloud backend (Rendi): uploads via its StorageProvider and returns the URL.
 */
async function resolvePathForBackend(
  localPath: string,
  backend: FFmpegBackend,
): Promise<string> {
  return backend.resolvePath(localPath);
}

// ─── PNG Rendering ───────────────────────────────────────────────────────────

/**
 * Render the blinking button and glow PNGs using Sharp.
 *
 * This is pure image generation — no FFmpeg, no backend calls.
 * Returns paths to two temp PNG files ready for use in an ffmpeg filter graph.
 */
export async function renderBlinkingButtonPngs(
  options: BlinkingButtonOptions,
): Promise<BlinkingButtonPngs> {
  const { text, width, height, bgColor, textColor } = options;

  const btnWidth = options.buttonWidth ?? Math.floor(width * 0.7);
  const btnHeight = options.buttonHeight ?? Math.floor(height * 0.09);
  const cornerRadius = Math.floor(btnHeight * 0.45);
  const glowRadius = 18;

  // Canvas sizing: must fit button at max animation scale + glow spread
  const totalMaxScale = 1.14 * 1.15; // button overshoot * glow extra
  const scalePad = Math.ceil(
    Math.max(btnWidth, btnHeight) * (totalMaxScale - 1) * 2,
  );
  const padding = scalePad + glowRadius * 2;
  const cw = even(btnWidth + padding * 2);
  const ch = even(btnHeight + padding * 2);
  const btnNativeW = even(btnWidth);
  const btnNativeH = even(btnHeight);

  const rgb = hexToRgb(bgColor);
  const topColor = {
    r: clamp(rgb.r * 1.15),
    g: clamp(rgb.g * 1.15),
    b: clamp(rgb.b * 1.15),
  };
  const bottomColor = {
    r: Math.floor(rgb.r * 0.95),
    g: Math.floor(rgb.g * 0.95),
    b: Math.floor(rgb.b * 0.95),
  };

  const svgBuf = Buffer.from(
    createButtonSvg(btnWidth, btnHeight, cornerRadius, topColor, bottomColor),
  );

  const fontPath = path.resolve(
    import.meta.dirname,
    "../../../../assets/fonts/TikTokSans-Bold.ttf",
  );

  const fontSize = Math.floor(btnHeight * 0.55);
  const textBuf = await sharp({
    text: {
      text: `<span foreground="${textColor}" font_weight="bold">${escapeXml(text)}</span>`,
      font: "TikTokSans",
      fontfile: fontPath,
      rgba: true,
      align: "center",
      dpi: Math.floor(fontSize * 2.8),
    },
  })
    .png()
    .toBuffer();

  const textMeta = await sharp(textBuf).metadata();
  const tw = textMeta.width ?? 0;
  const th = textMeta.height ?? 0;

  // Button at native size (small, for fast eq/scale processing)
  const btnNativeBuf = await sharp({
    create: {
      width: btnNativeW,
      height: btnNativeH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: svgBuf, top: 0, left: 0 },
      {
        input: textBuf,
        top: Math.floor((btnHeight - th) / 2),
        left: Math.floor((btnWidth - tw) / 2),
      },
    ])
    .png()
    .toBuffer();

  // Button at canvas size (for glow generation — blur needs surrounding pixels)
  const btnCenterX = Math.floor((cw - btnWidth) / 2);
  const btnCenterY = Math.floor((ch - btnHeight) / 2);

  const btnCanvasBuf = await sharp({
    create: {
      width: cw,
      height: ch,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: svgBuf, top: btnCenterY, left: btnCenterX },
      {
        input: textBuf,
        top: btnCenterY + Math.floor((btnHeight - th) / 2),
        left: btnCenterX + Math.floor((btnWidth - tw) / 2),
      },
    ])
    .png()
    .toBuffer();

  // Glow: blur + brighten + bake 60% max opacity
  const glowRaw = await sharp(btnCanvasBuf)
    .blur(glowRadius)
    .modulate({ brightness: 1.4 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 3; i < glowRaw.data.length; i += 4) {
    glowRaw.data[i] = Math.round((glowRaw.data[i] as number) * 0.6);
  }

  const glowBuf = await sharp(glowRaw.data, {
    raw: {
      width: glowRaw.info.width,
      height: glowRaw.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  // Write PNGs to temp files
  const ts = Date.now();
  const btnPngPath = `/tmp/varg-btn-${ts}.png`;
  const glowPngPath = `/tmp/varg-glow-${ts}.png`;

  await Promise.all([
    Bun.write(btnPngPath, btnNativeBuf),
    Bun.write(glowPngPath, glowBuf),
  ]);

  return {
    btnPngPath,
    glowPngPath,
    btnNativeW,
    btnNativeH,
    canvasWidth: cw,
    canvasHeight: ch,
  };
}

// ─── Filter Builder ──────────────────────────────────────────────────────────

export interface BlinkingButtonFilterParts {
  /** Filter_complex lines for the blinking button animation */
  filters: string[];
  /**
   * The output label of the final animated button stream (e.g. "btn_out").
   * This is a transparent RGBA video that can be overlaid onto the base.
   */
  outputLabel: string;
  /** Canvas width of the button animation */
  canvasWidth: number;
  /** Canvas height of the button animation */
  canvasHeight: number;
}

/**
 * Build the ffmpeg filter_complex lines for the blinking button animation.
 *
 * Takes the input indices for the button PNG and glow PNG,
 * and returns filter lines that can be merged into a larger filter_complex.
 *
 * @param btnInputIdx - ffmpeg input index for the button PNG (fed with -loop 1)
 * @param glowInputIdx - ffmpeg input index for the glow PNG (fed with -loop 1)
 * @param pngs - dimensions from renderBlinkingButtonPngs()
 * @param options - animation settings
 */
export function buildBlinkingButtonFilter(
  btnInputIdx: number,
  glowInputIdx: number,
  pngs: BlinkingButtonPngs,
  options: {
    duration: number;
    fps: number;
    blinkFrequency: number;
  },
): BlinkingButtonFilterParts {
  const { duration, fps, blinkFrequency } = options;
  const { btnNativeW, btnNativeH, canvasWidth: cw, canvasHeight: ch } = pngs;

  const P = blinkFrequency;
  const osc = oscExpr("t", P);

  // eq gamma for brightness: 0.85 at rest -> 1.2 at peak
  const gammaExpr = `0.85+0.35*max(0,${osc})`;

  // Button scale (on native-size input)
  const btnSW = `ceil(${btnNativeW}*(1.0+0.12*(${osc}))/2)*2`;
  const btnSH = `ceil(${btnNativeH}*(1.0+0.12*(${osc}))/2)*2`;

  // Glow scale (15% larger, on canvas-size input)
  const glowSW = `ceil(${cw}*(1.0+0.12*(${osc}))*1.15/2)*2`;
  const glowSH = `ceil(${ch}*(1.0+0.12*(${osc}))*1.15/2)*2`;

  const filters = [
    // Three transparent canvases (base + one per animated layer)
    `color=0x00000000:s=${cw}x${ch}:r=${fps}:d=${duration},format=rgba[btn_base]`,
    `color=0x00000000:s=${cw}x${ch}:r=${fps}:d=${duration},format=rgba[btn_canvas]`,
    `color=0x00000000:s=${cw}x${ch}:r=${fps}:d=${duration},format=rgba[glow_canvas]`,

    // Button: split alpha -> eq(gamma) -> merge alpha -> scale -> center on canvas
    `[${btnInputIdx}:v]format=rgba,split[btn_rgb][btn_a]`,
    `[btn_a]alphaextract[btn_alpha]`,
    `[btn_rgb]eq=gamma='${gammaExpr}':eval=frame[btn_eq]`,
    `[btn_eq][btn_alpha]alphamerge,format=rgba,` +
      `scale=w='${btnSW}':h='${btnSH}':eval=frame:flags=lanczos` +
      `[btn_scaled]`,
    `[btn_canvas][btn_scaled]overlay=x='(W-w)/2':y='(H-h)/2':format=auto:eval=frame:shortest=1[btn_layer]`,

    // Glow: scale -> center on canvas (opacity baked in PNG)
    `[${glowInputIdx}:v]format=rgba,` +
      `scale=w='${glowSW}':h='${glowSH}':eval=frame:flags=lanczos` +
      `[glow_scaled]`,
    `[glow_canvas][glow_scaled]overlay=x='(W-w)/2':y='(H-h)/2':format=auto:eval=frame:shortest=1[glow_layer]`,

    // Final composite: base -> glow -> button
    `[btn_base][glow_layer]overlay=format=auto:shortest=1[btn_bg]`,
    `[btn_bg][btn_layer]overlay=format=auto:shortest=1[btn_out]`,
  ];

  return {
    filters,
    outputLabel: "btn_out",
    canvasWidth: cw,
    canvasHeight: ch,
  };
}

// ─── Legacy standalone API ───────────────────────────────────────────────────

/**
 * Create a blinking CTA button video as a standalone operation.
 *
 * This is the legacy API that performs its own backend.run() call.
 * Prefer using renderBlinkingButtonPngs() + buildBlinkingButtonFilter()
 * to merge the button animation into a larger filter graph.
 */
export async function createBlinkingButton(
  options: BlinkingButtonOptions,
  backend: FFmpegBackend,
): Promise<BlinkingButtonResult> {
  const {
    duration,
    fps,
    blinkFrequency = 0.8,
    position = "bottom",
    width,
    height,
  } = options;

  const pngs = await renderBlinkingButtonPngs(options);

  // Resolve PNG paths for cloud backends (uploads to storage)
  const btnInput = await resolvePathForBackend(pngs.btnPngPath, backend);
  const glowInput = await resolvePathForBackend(pngs.glowPngPath, backend);

  const filterParts = buildBlinkingButtonFilter(0, 1, pngs, {
    duration,
    fps,
    blinkFrequency,
  });

  const ts = Date.now();
  const outputPath = `/tmp/varg-blink-btn-${ts}.mov`;

  const result = await backend.run({
    inputs: [
      { path: btnInput, options: ["-loop", "1"] },
      { path: glowInput, options: ["-loop", "1"] },
    ],
    filterComplex: filterParts.filters.join(";"),
    outputArgs: [
      "-map",
      `[${filterParts.outputLabel}]`,
      "-c:v",
      "prores_ks",
      "-profile:v",
      "4444",
      "-pix_fmt",
      "yuva444p10le",
      "-t",
      String(duration),
    ],
    outputPath,
  });

  const { canvasWidth: cw, canvasHeight: ch } = pngs;
  const btnY = getButtonYPosition(position, height, ch);
  const btnX = Math.floor((width - cw) / 2);

  return {
    output: result.output,
    x: btnX,
    y: btnY,
    canvasWidth: cw,
    canvasHeight: ch,
  };
}
