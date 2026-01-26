import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 255, g: 107, b: 0 }; // Default orange
  }
  return {
    r: parseInt(result[1] as string, 16),
    g: parseInt(result[2] as string, 16),
    b: parseInt(result[3] as string, 16),
  };
}

/**
 * Clamp value to max (for color brightening)
 */
function clamp(value: number, max = 255): number {
  return Math.min(Math.floor(value), max);
}

/**
 * Create SVG for button background with gradient and rounded corners
 */
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

/**
 * Create a blinking CTA button video using Sharp for image generation
 * and ffmpeg for video assembly.
 *
 * Matches Python SDK quality:
 * - Gradient background (lighter top -> darker bottom)
 * - Rounded corners (45% of height)
 * - Scale animation (1.0 -> 1.03)
 * - Brightness animation (0.85 -> 1.2)
 * - Custom font support (TikTokSans-Bold)
 */
export interface BlinkingButtonResult {
  path: string;
  x: number;
  y: number;
}

export async function createBlinkingButton(
  options: BlinkingButtonOptions,
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

  const totalFrames = Math.ceil(duration * fps);

  // Button dimensions — large and prominent like app store CTAs
  const btnWidth = options.buttonWidth ?? Math.floor(width * 0.7);
  const btnHeight = options.buttonHeight ?? Math.floor(height * 0.09);
  const cornerRadius = Math.floor(btnHeight * 0.45);

  // Animation padding (button can grow 3%, add extra margin)
  const maxScale = 1.03;
  const padding = Math.ceil(
    Math.max(btnWidth, btnHeight) * (maxScale - 1.0) * 2,
  );
  const canvasWidth = btnWidth + padding * 2;
  const canvasHeight = btnHeight + padding * 2;

  // Parse colors and create gradient (lighter top, darker bottom)
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

  // Font path (relative to this file's compiled location)
  const fontPath = path.resolve(
    import.meta.dirname,
    "../../../assets/fonts/TikTokSans-Bold.ttf",
  );

  // Create button SVG with gradient
  const buttonSvg = createButtonSvg(
    btnWidth,
    btnHeight,
    cornerRadius,
    topColor,
    bottomColor,
  );

  // Create text image using Sharp's text feature
  const fontSize = Math.floor(btnHeight * 0.55);
  const textBuffer = await sharp({
    text: {
      text: `<span foreground="${textColor}" font_weight="bold">${escapeXml(text)}</span>`,
      font: "TikTokSans",
      fontfile: fontPath,
      rgba: true,
      align: "center",
      dpi: Math.floor(fontSize * 2.8), // Larger DPI for bolder text
    },
  })
    .png()
    .toBuffer();

  // Get text dimensions for centering
  const textMeta = await sharp(textBuffer).metadata();
  const textWidth = textMeta.width ?? 0;
  const textHeight = textMeta.height ?? 0;

  // Create base button frame (button + text on transparent canvas)
  const baseButtonBuffer = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      // Button background (centered in canvas)
      {
        input: Buffer.from(buttonSvg),
        top: padding,
        left: padding,
      },
      // Text centered on button
      {
        input: textBuffer,
        top: padding + Math.floor((btnHeight - textHeight) / 2),
        left: padding + Math.floor((btnWidth - textWidth) / 2),
      },
    ])
    .png()
    .toBuffer();

  // Calculate button position on full frame
  const btnY = getButtonYPosition(position, height, canvasHeight);
  const btnX = Math.floor((width - canvasWidth) / 2);

  // Create frames directory for intermediate files
  const framesDir = `/tmp/varg-btn-frames-${Date.now()}`;
  await mkdir(framesDir, { recursive: true });

  // Generate animation frames
  // Using file-based approach for reliability with alpha channel
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    const phase = (t / blinkFrequency) * 2 * Math.PI;
    const osc = (Math.sin(phase) + 1) / 2;

    const scale = 1.0 + 0.03 * osc; // 1.0 -> 1.03 -> 1.0
    const brightness = 0.85 + 0.35 * osc; // 0.85 -> 1.2 -> 0.85

    const scaledW = Math.round(canvasWidth * scale);
    const scaledH = Math.round(canvasHeight * scale);

    // Calculate offset to keep button centered after scaling
    const offsetX = Math.floor((canvasWidth - scaledW) / 2);
    const offsetY = Math.floor((canvasHeight - scaledH) / 2);

    // Scale button, apply brightness, then center on canvas
    let pipeline = sharp(baseButtonBuffer)
      .resize(scaledW, scaledH, { kernel: "lanczos3" })
      .modulate({ brightness });

    // Extend back to original canvas size with transparent background
    if (offsetX !== 0 || offsetY !== 0) {
      pipeline = pipeline.extend({
        top: Math.max(0, offsetY),
        bottom: Math.max(0, canvasHeight - scaledH - offsetY),
        left: Math.max(0, offsetX),
        right: Math.max(0, canvasWidth - scaledW - offsetX),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    // Write button-sized frame directly (skip full-frame composite for perf)
    await pipeline
      .png()
      .toFile(`${framesDir}/frame_${String(i).padStart(5, "0")}.png`);
  }

  // Combine frames into video with alpha channel (ProRes 4444)
  const outputPath = `/tmp/varg-blink-btn-${Date.now()}.mov`;

  await runFfmpeg([
    "-y",
    "-framerate",
    String(fps),
    "-i",
    `${framesDir}/frame_%05d.png`,
    "-c:v",
    "prores_ks",
    "-profile:v",
    "4444",
    "-pix_fmt",
    "yuva444p10le",
    "-t",
    String(duration),
    outputPath,
  ]);

  // Cleanup frames directory
  await rm(framesDir, { recursive: true, force: true });

  return { path: outputPath, x: btnX, y: btnY };
}

/**
 * Calculate button Y position based on position prop
 */
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
    case "bottom":
    default:
      return Math.floor(videoHeight * 0.78 - buttonHeight / 2);
  }
}

/**
 * Escape XML special characters for SVG/Pango text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Run ffmpeg command and wait for completion
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    ffmpeg.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", reject);
  });
}
