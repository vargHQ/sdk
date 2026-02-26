import path from "node:path";
import sharp from "sharp";
import type {
  FFmpegBackend,
  FFmpegOutput,
} from "../../../ai-sdk/providers/editly/backends/types";
import { uploadBuffer } from "../../../providers/storage";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
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

function createButtonSvg(
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getButtonYPosition(
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
function even(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Elastic ease oscillator as an ffmpeg expression.
 * Period P seconds, using time variable `tv` ("t" for scale/eq, "T" for geq).
 * Returns 0 → 1.15 (overshoot) → 1.0 (settle) → 0 (fall) per cycle.
 */
function oscExpr(tv: string, P: number): string {
  const ph = `(mod(${tv},${P})/${P})`;
  return `if(lt(${ph},0.25),sin(${ph}/0.25*PI/2)*1.15,if(lt(${ph},0.4),1.15-0.15*(${ph}-0.25)/0.15,cos((${ph}-0.4)/0.6*PI/2)))`;
}

/**
 * Resolve a local file path to a URL for cloud backends.
 * Local backend: returns the path as-is.
 * Cloud backend: uploads the file and returns the URL.
 */
async function resolvePathForBackend(
  localPath: string,
  backend: FFmpegBackend,
): Promise<string> {
  if (backend.name === "local") return localPath;
  const buffer = await Bun.file(localPath).arrayBuffer();
  const key = `tmp/${Date.now()}-${localPath.split("/").pop()}`;
  return uploadBuffer(buffer, key, "image/png");
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Create a blinking CTA button video using Sharp for static PNG rendering
 * and a single FFmpeg filter_complex for all animation.
 *
 * Architecture:
 *   1. Sharp renders 2 static PNGs: button (native size) + glow (canvas size)
 *   2. FFmpeg filter_complex does per-frame animation via expressions:
 *      - eq(gamma, eval=frame) for brightness pulse (0.85x → 1.2x)
 *      - scale(eval=frame) for elastic zoom pulse (1.0x → 1.14x)
 *      - overlay with (W-w)/2 centering for perfect bbox alignment
 *      - Glow scales 15% larger with 60% max opacity baked in
 *   3. Output is ProRes 4444 with alpha channel
 *
 * Works on both local (ffmpeg binary) and cloud (rendi) backends
 * via the FFmpegBackend abstraction.
 */
export async function createBlinkingButton(
  options: BlinkingButtonOptions,
  backend: FFmpegBackend,
): Promise<BlinkingButtonResult> {
  const {
    text,
    width,
    height,
    duration,
    fps,
    bgColor,
    textColor,
    blinkFrequency = 0.8,
    position = "bottom",
  } = options;

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

  // ── Step 1: Render PNGs with Sharp ─────────────────────────────────────────

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

  // ── Step 2: Build ffmpeg filter_complex ────────────────────────────────────

  const P = blinkFrequency;
  const osc = oscExpr("t", P);

  // eq gamma for brightness: 0.85 at rest → 1.2 at peak
  const gammaExpr = `0.85+0.35*max(0,${osc})`;

  // Button scale (on native-size input)
  const btnSW = `ceil(${btnNativeW}*(1.0+0.12*(${osc}))/2)*2`;
  const btnSH = `ceil(${btnNativeH}*(1.0+0.12*(${osc}))/2)*2`;

  // Glow scale (15% larger, on canvas-size input)
  const glowSW = `ceil(${cw}*(1.0+0.12*(${osc}))*1.15/2)*2`;
  const glowSH = `ceil(${ch}*(1.0+0.12*(${osc}))*1.15/2)*2`;

  // Filter complex: uses overlay for centering (no crop+pad drift)
  const filterComplex = [
    // Three transparent canvases (base + one per animated layer)
    `color=0x00000000:s=${cw}x${ch}:r=${fps}:d=${duration},format=rgba[base]`,
    `color=0x00000000:s=${cw}x${ch}:r=${fps}:d=${duration},format=rgba[btn_canvas]`,
    `color=0x00000000:s=${cw}x${ch}:r=${fps}:d=${duration},format=rgba[glow_canvas]`,

    // Button: split alpha → eq(gamma) → merge alpha → scale → center on canvas
    `[0:v]format=rgba,split[btn_rgb][btn_a]`,
    `[btn_a]alphaextract[alpha]`,
    `[btn_rgb]eq=gamma='${gammaExpr}':eval=frame[btn_eq]`,
    `[btn_eq][alpha]alphamerge,format=rgba,` +
      `scale=w='${btnSW}':h='${btnSH}':eval=frame:flags=lanczos` +
      `[btn_scaled]`,
    `[btn_canvas][btn_scaled]overlay=x='(W-w)/2':y='(H-h)/2':format=auto:eval=frame:shortest=1[btn]`,

    // Glow: scale → center on canvas (opacity baked in PNG)
    `[1:v]format=rgba,` +
      `scale=w='${glowSW}':h='${glowSH}':eval=frame:flags=lanczos` +
      `[glow_scaled]`,
    `[glow_canvas][glow_scaled]overlay=x='(W-w)/2':y='(H-h)/2':format=auto:eval=frame:shortest=1[glow]`,

    // Final composite: base → glow → button
    `[base][glow]overlay=format=auto:shortest=1[bg]`,
    `[bg][btn]overlay=format=auto:shortest=1[out]`,
  ].join(";");

  // ── Step 3: Run ffmpeg via backend ─────────────────────────────────────────

  // Resolve PNG paths for cloud backends (uploads to storage)
  const btnInput = await resolvePathForBackend(btnPngPath, backend);
  const glowInput = await resolvePathForBackend(glowPngPath, backend);

  const outputPath = `/tmp/varg-blink-btn-${ts}.mov`;

  const result = await backend.run({
    inputs: [
      { path: btnInput, options: ["-loop", "1"] },
      { path: glowInput, options: ["-loop", "1"] },
    ],
    filterComplex,
    outputArgs: [
      "-map",
      "[out]",
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

  // ── Calculate overlay position on full video frame ─────────────────────────

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
