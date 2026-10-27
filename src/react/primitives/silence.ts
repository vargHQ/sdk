/**
 * Silence detection — find quiet intervals in an audio file via ffmpeg
 * `silencedetect` filter, and compute the bounds of audible content.
 */

import { $ } from "bun";
import type { File } from "../../ai-sdk/file";
import { getResolveContext } from "../resolve-context";

export interface SilenceDetectOptions {
  /** Noise threshold in dB — audio below this level counts as silence. Default -30. */
  noiseDb?: number;
  /** Minimum silence duration in seconds to report. Default 0.3. */
  minDuration?: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Detect intervals of silence in an audio file via ffmpeg `silencedetect`.
 *
 * Note: silencedetect finds *sound*, not speech — ambient noise and
 * footsteps count as sound. For speech-specific boundaries combine with
 * `transcribeAudio()` word timings.
 *
 * Runs local ffmpeg only (silencedetect output is on stderr, which cloud
 * backends don't return). Reads URLs directly when available.
 *
 * @throws Error if a cloud backend is active (silencedetect requires local
 *         ffmpeg stderr parsing, which cloud backends don't support).
 */
export async function detectSilence(
  file: File,
  options: SilenceDetectOptions = {},
): Promise<TimeRange[]> {
  const ctx = getResolveContext();
  if (ctx?.backend && ctx.backend.name !== "local") {
    throw new Error(
      `detectSilence requires local ffmpeg — cloud backend "${ctx.backend.name}" does not support silencedetect (stderr parsing). ` +
        `Run this operation outside the render pipeline or use a local backend.`,
    );
  }

  const noiseDb = options.noiseDb ?? -30;
  const minDuration = options.minDuration ?? 0.3;
  const isUrlInput = file.url != null;
  const input = file.url ?? (await file.toTempFile());
  try {
    const result =
      await $`ffmpeg -i ${input} -af silencedetect=noise=${noiseDb}dB:d=${minDuration} -f null -`
        .quiet()
        .nothrow();
    // silencedetect logs to stderr; ffmpeg exits 0 on success for -f null
    const stderr = result.stderr.toString();

    return parseSilenceRanges(stderr);
  } finally {
    if (!isUrlInput) {
      try {
        await Bun.file(input).delete?.();
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

/** Parse ffmpeg silencedetect stderr output into TimeRange[]. Exported for speech-activity.ts. */
export function parseSilenceRanges(stderr: string): TimeRange[] {
  const ranges: TimeRange[] = [];
  let currentStart: number | undefined;
  for (const line of stderr.split("\n")) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch?.[1]) {
      currentStart = Number.parseFloat(startMatch[1]);
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch?.[1] && currentStart !== undefined) {
      ranges.push({
        start: currentStart,
        end: Number.parseFloat(endMatch[1]),
      });
      currentStart = undefined;
    }
  }
  // Trailing silence (silence_start without silence_end — runs to EOF)
  if (currentStart !== undefined) {
    const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (durationMatch) {
      const total =
        Number.parseInt(durationMatch[1] ?? "0", 10) * 3600 +
        Number.parseInt(durationMatch[2] ?? "0", 10) * 60 +
        Number.parseFloat(durationMatch[3] ?? "0");
      ranges.push({ start: currentStart, end: total });
    }
  }
  return ranges;
}

export interface RefineWordTimingsOptions {
  /**
   * Minimum remaining duration of the first/last word after clamping,
   * in seconds. Default 0.05.
   */
  minWordDuration?: number;
}

/**
 * Refine whisper word timings against measured silence intervals.
 *
 * Whisper is a seq2seq transcriber, not a frame-level speech detector: its
 * word timestamps come from attention alignment, and leading silence/noise
 * frames have no tokens of their own — their attention mass is absorbed by
 * the FIRST word, which gets `start = 0` even when speech begins ~1s in
 * (the ep5 case: "I" at 0.000 under a second of footsteps/ambience).
 * The tail is symmetric: the last word's `end` stretches toward EOF.
 *
 * ffmpeg silencedetect measures signal energy directly, so silence knows
 * the truth whisper lost. Rules:
 * - leading silence [0, T): clamp `words[0].start` up to
 *   `min(T, words[0].end − minWordDuration)`
 * - trailing silence [S, duration]: clamp `words[last].end` down to
 *   `max(S, words[last].start + minWordDuration)`
 * - middle words are never touched (ambient noise between words must not
 *   fragment speech)
 *
 * No leading/trailing silence found → no-op. Returns new objects; input
 * is not mutated.
 */
export function refineWordTimings<W extends { start: number; end: number }>(
  words: W[],
  silences: TimeRange[],
  duration: number,
  options: RefineWordTimingsOptions = {},
): W[] {
  if (words.length === 0) return words;
  const minWord = options.minWordDuration ?? 0.05;
  const result = words.map((w) => ({ ...w }));

  for (const s of silences) {
    // Leading silence: starts at (or near) 0 and covers the first word's start
    if (s.start <= 0.05) {
      const first = result[0]!;
      if (first.start < s.end) {
        first.start = Math.min(
          s.end,
          Math.max(first.start, first.end - minWord),
        );
      }
    }
    // Trailing silence: runs to (or near) EOF and covers the last word's end
    if (duration > 0 && s.end >= duration - 0.05) {
      const last = result[result.length - 1]!;
      if (last.end > s.start) {
        last.end = Math.max(s.start, Math.min(last.end, last.start + minWord));
      }
    }
  }
  return result;
}

/**
 * Compute the bounds of audible content: `start` of the first sound and
 * `end` of the last sound, derived from silence intervals.
 *
 * @param duration Total media duration in seconds.
 */
export function computeSoundBounds(
  silences: TimeRange[],
  duration: number,
): TimeRange {
  let start = 0;
  let end = duration;
  for (const s of silences) {
    // Leading silence
    if (s.start <= 0.05 && s.end > start) start = s.end;
    // Trailing silence
    if (duration > 0 && s.end >= duration - 0.05 && s.start < end)
      end = s.start;
  }
  return { start, end: Math.max(start, end) };
}
