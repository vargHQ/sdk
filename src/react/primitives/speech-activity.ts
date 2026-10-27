/**
 * Speech-activity detection — find WHEN there is voice, not just sound.
 *
 * Broadband silencedetect cannot distinguish voice from footsteps or
 * birdsong, so `speechRange` built on it (or on whisper's attention-based
 * word timings) starts captions and auto-trims too early. Speech energy
 * concentrates in the telephone band (~200-3400 Hz); footsteps are
 * low-frequency thumps and birds sit at 2-8 kHz, so a bandpass before
 * silencedetect yields a voice-selective activity signal from a single
 * ffmpeg pass with zero extra dependencies.
 *
 * This is deliberately a *provider interface*: `detectSpeechActivity` is
 * the default ffmpeg-bandpass implementation, and a real VAD (e.g.
 * silero-vad via ONNX) can replace it behind the same signature — see
 * the tracking issue for the upgrade path.
 */

import { $ } from "bun";
import type { File } from "../../ai-sdk/file";
import { getResolveContext } from "../resolve-context";
import { parseSilenceRanges, type TimeRange } from "./silence";

export interface SpeechActivityOptions {
  /** Noise threshold in dB within the voice band. Default -30. */
  noiseDb?: number;
  /** Minimum silence duration (s) to split activity. Default 0.15. */
  minSilence?: number;
  /** Voice bandpass in Hz. Default { low: 200, high: 3400 }. */
  band?: { low: number; high: number };
  /**
   * Activity intervals separated by a gap smaller than this (s) are
   * merged — natural inter-word pauses must not fragment one utterance.
   * Default 0.3.
   */
  mergeGap?: number;
  /** Drop activity intervals shorter than this (s) — residual noise
   *  bursts that survived the bandpass. Default 0.1. */
  minActivity?: number;
}

/**
 * Invert silence intervals into activity intervals over [0, duration].
 * Pure — exported for tests.
 */
export function invertSilences(
  silences: TimeRange[],
  duration: number,
): TimeRange[] {
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  const activity: TimeRange[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) activity.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (duration > cursor) activity.push({ start: cursor, end: duration });
  return activity;
}

/**
 * Merge activity intervals whose gap is below `mergeGap`, then drop
 * intervals shorter than `minActivity`. Pure — exported for tests.
 */
export function mergeActivity(
  intervals: TimeRange[],
  mergeGap: number,
  minActivity: number,
): TimeRange[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.start - last.end <= mergeGap) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged.filter((r) => r.end - r.start >= minActivity);
}

/**
 * Detect voice-activity intervals via bandpassed ffmpeg silencedetect.
 *
 * Local ffmpeg only (silencedetect output is on stderr, which cloud
 * backends don't return) — same constraint as `detectSilence`.
 */
export async function detectSpeechActivity(
  file: File,
  duration: number,
  options: SpeechActivityOptions = {},
): Promise<TimeRange[]> {
  const ctx = getResolveContext();
  if (ctx?.backend && ctx.backend.name !== "local") {
    throw new Error(
      `detectSpeechActivity requires local ffmpeg — cloud backend "${ctx.backend.name}" does not support silencedetect (stderr parsing).`,
    );
  }

  const noiseDb = options.noiseDb ?? -30;
  const minSilence = options.minSilence ?? 0.15;
  const band = options.band ?? { low: 200, high: 3400 };
  const mergeGap = options.mergeGap ?? 0.3;
  const minActivity = options.minActivity ?? 0.1;

  const isUrlInput = file.url != null;
  const input = file.url ?? (await file.toTempFile());
  try {
    const result =
      await $`ffmpeg -i ${input} -af highpass=f=${band.low},lowpass=f=${band.high},silencedetect=noise=${noiseDb}dB:d=${minSilence} -f null -`
        .quiet()
        .nothrow();
    const stderr = result.stderr.toString();
    const silences = parseSilenceRanges(stderr);

    // Prefer the container duration from stderr (parseSilenceRanges already
    // reads it for trailing silence); the caller-provided duration is the
    // fallback when ffmpeg didn't print one.
    const activity = invertSilences(silences, duration);
    return mergeActivity(activity, mergeGap, minActivity);
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

/**
 * Align word timings to measured speech activity.
 *
 * Words say WHAT was spoken; activity says WHEN there is voice energy.
 * Whisper's boundary words are unreliable (attention absorbs leading
 * ambience into the first word and stretches the last toward EOF), so:
 *
 * - The speech onset = start of the first activity interval that overlaps
 *   (or follows) the word span; leading words lying entirely before it
 *   are PUSHED to the onset preserving their duration (a clamp cannot fix
 *   a word whisper placed wholly inside ambience). Downstream
 *   `monotonizeEntries` cascades the shift through following words.
 * - The speech offset = end of the last activity interval overlapping the
 *   word span; the last word's end is clamped down to it.
 * - Middle words are never touched.
 *
 * Empty activity (uniform loud ambience, quiet voice) → words returned
 * unchanged — never worse than trusting whisper. Pure — exported for tests.
 */
export function alignWordsToActivity<W extends { start: number; end: number }>(
  words: W[],
  activity: TimeRange[],
): W[] {
  if (words.length === 0 || activity.length === 0) return words;

  const result = words.map((w) => ({ ...w }));
  const spanStart = result[0]!.start;
  const spanEnd = result[result.length - 1]!.end;

  // Activity intervals relevant to the utterance: overlap the word span,
  // or (for the onset) the first interval starting after the span start.
  const overlapping = activity.filter(
    (a) => a.end > spanStart && a.start < spanEnd,
  );
  const relevant =
    overlapping.length > 0
      ? overlapping
      : activity.filter((a) => a.start >= spanStart).slice(0, 1);
  if (relevant.length === 0) return result;

  const onset = relevant[0]!.start;
  const offset = relevant[relevant.length - 1]!.end;

  // Push leading words that lie entirely before the voice onset.
  for (const w of result) {
    if (w.end <= onset) {
      const d = w.end - w.start;
      w.start = onset;
      w.end = onset + d;
    } else {
      // First word that reaches into activity: clamp its start up to onset.
      if (w.start < onset) w.start = onset;
      break;
    }
  }

  // Clamp the last word's end down to the voice offset.
  const last = result[result.length - 1]!;
  if (last.end > offset) {
    last.end = Math.max(offset, last.start + 0.05);
  }

  return result;
}
