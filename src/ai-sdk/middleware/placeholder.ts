import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

export interface PlaceholderOptions {
  type: "image" | "video" | "audio";
  prompt: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface PlaceholderResult {
  data: Uint8Array;
  placeholder: true;
}

function promptToColor(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const h = Math.abs(hash) % 360;
  const s = 40 + (Math.abs(hash >> 8) % 30);
  const l = 35 + (Math.abs(hash >> 16) % 20);

  return `hsl(${h},${s}%,${l}%)`;
}

function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
  if (!match) return "333333";

  const h = Number.parseInt(match[1]!) / 360;
  const s = Number.parseInt(match[2]!) / 100;
  const l = Number.parseInt(match[3]!) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function truncatePrompt(text: string, maxLen: number): string {
  const clean = text.replace(/[^a-zA-Z0-9 .,!?-]/g, "");
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 3)}...`;
}

export async function generatePlaceholder(
  options: PlaceholderOptions,
): Promise<PlaceholderResult> {
  const { type, prompt, duration = 3, width = 1080, height = 1920 } = options;

  const color = promptToColor(prompt);
  const hexColor = hslToHex(color);
  const labelFontSize = Math.floor(Math.min(width, height) / 20);
  const promptFontSize = Math.floor(Math.min(width, height) / 35);
  const maxChars = Math.floor((width * 0.7) / (promptFontSize * 0.5));
  const typeLabel = type.toUpperCase();
  const promptText = truncatePrompt(prompt, maxChars);

  const ext = type === "audio" ? "mp3" : type === "image" ? "png" : "mp4";
  const outputPath = join(
    tmpdir(),
    `placeholder_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`,
  );

  try {
    if (type === "audio") {
      await $`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a libmp3lame ${outputPath}`.quiet();
    } else if (type === "image") {
      const colorInput = `color=c=0x${hexColor}:s=${width}x${height}:d=1`;
      const labelY = `(h/2)-${labelFontSize}`;
      const promptY = `(h/2)+${Math.floor(labelFontSize * 0.5)}`;
      const drawLabel = `drawtext=text='${typeLabel}':fontcolor=white:fontsize=${labelFontSize}:x=(w-text_w)/2:y=${labelY}`;
      const drawPrompt = `drawtext=text='${promptText}':fontcolor=white@0.7:fontsize=${promptFontSize}:x=(w-text_w)/2:y=${promptY}`;
      await $`ffmpeg -y -f lavfi -i ${colorInput} -vf ${drawLabel},${drawPrompt} -frames:v 1 -update 1 ${outputPath}`.quiet();
    } else {
      const colorInput = `color=c=0x${hexColor}:s=${width}x${height}:d=${duration}:r=30`;
      const labelY = `(h/2)-${labelFontSize}`;
      const promptY = `(h/2)+${Math.floor(labelFontSize * 0.5)}`;
      const drawLabel = `drawtext=text='${typeLabel}':fontcolor=white:fontsize=${labelFontSize}:x=(w-text_w)/2:y=${labelY}`;
      const drawPrompt = `drawtext=text='${promptText}':fontcolor=white@0.7:fontsize=${promptFontSize}:x=(w-text_w)/2:y=${promptY}`;
      await $`ffmpeg -y -f lavfi -i ${colorInput} -vf ${drawLabel},${drawPrompt} -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputPath}`.quiet();
    }

    const data = await Bun.file(outputPath).bytes();
    await unlink(outputPath).catch(() => {});
    return { data: new Uint8Array(data), placeholder: true };
  } catch (e) {
    await unlink(outputPath).catch(() => {});
    throw e;
  }
}
