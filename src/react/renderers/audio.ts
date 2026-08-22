import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends";

interface ResolveVideoMixVolumeOptions {
  backend: FFmpegBackend;
  keepAudio?: boolean;
  path: string;
  volume?: number;
}

/**
 * Source audio is enabled by default, but only when the input actually has an
 * audio stream. Explicit true preserves the previous force-on behavior.
 */
export async function resolveVideoMixVolume({
  backend,
  keepAudio,
  path,
  volume,
}: ResolveVideoMixVolumeOptions): Promise<number> {
  if (keepAudio === false) return 0;
  if (keepAudio === true) return volume ?? 1;

  try {
    const info = await backend.ffprobe(path);
    return info.hasAudio === true ? (volume ?? 1) : 0;
  } catch {
    // Auto mode must not make an otherwise valid silent video fail rendering.
    return 0;
  }
}
