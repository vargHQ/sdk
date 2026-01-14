import { $ } from "bun";
import type { VideoInfo } from "./types";

const FFMPEG_COMMON_ARGS = ["-hide_banner", "-loglevel", "error"];

export async function ffmpeg(
  args: string[],
  options?: { stdin?: "pipe" | "ignore"; stdout?: "pipe" | "inherit" },
): Promise<{ stdout: Buffer; exitCode: number }> {
  const proc = Bun.spawn(["ffmpeg", ...FFMPEG_COMMON_ARGS, ...args], {
    stdin: options?.stdin ?? "ignore",
    stdout: options?.stdout === "inherit" ? "inherit" : "pipe",
    stderr: "inherit",
  });

  const stdout =
    options?.stdout === "inherit"
      ? Buffer.alloc(0)
      : Buffer.from(await new Response(proc.stdout).arrayBuffer());
  const exitCode = await proc.exited;

  return { stdout, exitCode };
}

export async function ffprobe(path: string): Promise<VideoInfo> {
  const result =
    await $`ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_type -show_entries format=duration -of json ${path}`.json();

  const videoStream = result.streams?.find(
    (s: { codec_type: string }) => s.codec_type === "video",
  );
  const duration = parseFloat(result.format?.duration ?? "0");

  let fps: number | undefined;
  const framerateStr: string | undefined = videoStream?.r_frame_rate;
  if (framerateStr) {
    const parts = framerateStr.split("/").map(Number);
    const num = parts[0];
    const den = parts[1];
    if (den && den > 0 && num) fps = num / den;
  }

  return {
    duration,
    width: videoStream?.width,
    height: videoStream?.height,
    fps,
    framerateStr,
  };
}

export async function readDuration(path: string): Promise<number> {
  const result =
    await $`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${path}`.text();
  return parseFloat(result.trim());
}

export function multipleOf2(n: number): number {
  return Math.round(n / 2) * 2;
}
