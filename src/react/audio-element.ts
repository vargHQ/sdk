/**
 * AudioNode — the derived audio element returned by `video.audio` and
 * `speech.audio`.
 *
 * A lazy, memoized VargElement<"audio"> that:
 * - resolves on `await` (video parent → ffmpeg -vn extraction; speech
 *   parent → reuses the speech audio file + word timings)
 * - exposes analysis helpers: `transcribe()`, `silenceSegments()`, `range()`,
 *   `speechRange()`
 * - is accepted everywhere a speech element is accepted (clip child,
 *   `prompt.audio`, TalkingHead audio, `Captions src`)
 *
 * Unlike the factory elements (Image/Video/Speech), the `.then` here is
 * memoized instead of self-deleting: re-awaiting returns the same
 * ResolvedElement, and `resolveLazy` strips `.then` from tree copies so
 * `Promise.all` never triggers accidental resolution.
 */

import type { WordTiming } from "../speech/types";
import type {
  SilenceDetectOptions,
  SpeechActivityOptions,
  TimeRange,
  TranscriptionResult,
} from "./primitives/audio";
import {
  alignWordsToActivity,
  computeSoundBounds,
  detectSilence,
  detectSpeechActivity,
  refineWordTimings,
  transcribeAudio,
} from "./primitives/audio";
import { getActiveCache, resolveAudioElement } from "./resolve";
import { getResolveContext } from "./resolve-context";
import type { ResolvedElement } from "./resolved-element";
import type { AudioElementProps, VargElement } from "./types";

export interface AudioNode
  extends VargElement<"audio">,
    PromiseLike<ResolvedElement<"audio">> {
  /**
   * Transcribe the audio to `{ text, words }` with word-level timestamps.
   *
   * - Parent speech with native ElevenLabs alignment → reused as-is
   *   (character-level accuracy, no refinement needed, no whisper call).
   * - Whisper words → boundary-refined against ffmpeg silencedetect by
   *   default: whisper absorbs leading silence into the first word
   *   (start=0 under a second of ambience) and stretches the last word
   *   toward EOF; measured silence clamps both. Middle words untouched.
   *   Pass `refine: false` to get raw whisper timings.
   *
   * Memoized per node: repeated calls (and `speechRange()`) share one
   * transcription + one silencedetect run. Disk-cached by content hash;
   * refinement is applied on top of the cache (raw transcript stays the
   * source of truth).
   */
  transcribe(options?: {
    refine?: boolean;
    noiseDb?: number;
    /** Context hint for Whisper — names, terms, domain language. */
    prompt?: string;
  }): Promise<TranscriptionResult>;
  /**
   * Detect silence intervals via ffmpeg `silencedetect`.
   * Note: detects *sound*, not speech — ambient noise counts as sound.
   * Memoized per node per options.
   */
  silenceSegments(options?: SilenceDetectOptions): Promise<TimeRange[]>;
  /**
   * Range of audible content: start of first sound, end of last sound.
   * Derived from `silenceSegments()`.
   *
   * Note: this is *sound*, not speech — ambient noise, footsteps, and music
   * count. For "where do they actually talk", use `speechRange()`.
   */
  range(options?: SilenceDetectOptions): Promise<TimeRange>;
  /**
   * Range of actual speech: start of the first spoken word, end of the
   * last one, from word-level transcription timings (`transcribe()` —
   * native ElevenLabs alignment when present, whisper otherwise; cached,
   * silence-refined by default so leading ambience does not pull the
   * range to 0).
   *
   * Returns `null` when no speech is detected (empty transcript). Word
   * boundaries from whisper carry ~±0.1s slack — pass `pad` to widen the
   * range for soft trims (clamped to [0, duration]).
   *
   * Memoized per node per options: repeated calls return the same
   * promise, sharing the transcription with `transcribe()`.
   */
  speechRange(options?: {
    pad?: number;
    refine?: boolean;
    noiseDb?: number;
  }): Promise<TimeRange | null>;
  /**
   * Duration in seconds. Available synchronously when derived from an
   * already-resolved parent (e.g. `const { audio } = await Speech(...)`);
   * 0 before resolution otherwise.
   */
  readonly duration: number;
  /** Word-level timings inherited from a resolved speech parent, if any. */
  readonly words: WordTiming[] | undefined;
}

/** Parent types whose file is already an audio track (no extraction needed). */
const AUDIO_FILE_PARENTS = new Set(["speech", "audio", "music"]);

/**
 * Create an AudioNode derived from a parent element (or a direct src).
 *
 * When the parent is an already-resolved speech element, the node is born
 * pre-resolved (meta set from the parent's file + words) — renderers and
 * compile() treat it as done.
 */
export function makeAudioNode(props: AudioElementProps): AudioNode {
  const element: VargElement<"audio"> = {
    type: "audio",
    props: props as Record<string, unknown>,
    children: [],
  };

  const parent = props.parent;
  // Pre-seed meta when the parent already carries an *audio* file.
  // Video parents still require extraction even when resolved.
  if (parent?.meta?.file && AUDIO_FILE_PARENTS.has(parent.type)) {
    element.meta = {
      file: parent.meta.file,
      duration: parent.meta.duration,
      words: parent.meta.words,
    };
  }

  const node = element as AudioNode;
  let resolvedPromise: Promise<ResolvedElement<"audio">> | undefined;
  const resolveOnce = () => {
    // Sync element.meta after resolution so the sync getters
    // (.duration, .words) and renderers see the resolved file.
    resolvedPromise ??= resolveAudioElement(element).then((r) => {
      element.meta = r.meta;
      return r;
    });
    return resolvedPromise;
  };

  // Memoized thenable — safe to re-await (unlike makeThenable's
  // consume-on-first-call semantics).
  // biome-ignore lint/suspicious/noThenProperty: intentional — makes element awaitable
  node.then = (onFulfilled, onRejected) =>
    resolveOnce().then(onFulfilled, onRejected);

  // -------------------------------------------------------------------
  // Per-node memoization of analysis results. One AudioNode per parent
  // (WeakMap in the .audio getters), so every consumer — DialogueClip's
  // speechRange, Captions' transcription, user code — shares one
  // transcription and one silencedetect run per option set.
  // -------------------------------------------------------------------
  const memo = new Map<string, Promise<unknown>>();
  const memoize = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    let existing = memo.get(key);
    if (!existing) {
      existing = fn();
      memo.set(key, existing);
    }
    return existing as Promise<T>;
  };

  const detectSilenceOnce = (options?: SilenceDetectOptions) =>
    memoize(`silence:${JSON.stringify(options ?? {})}`, async () => {
      const resolved = await resolveOnce();
      return detectSilence(resolved.meta.file, options);
    });

  const detectActivityOnce = (options?: SpeechActivityOptions) =>
    memoize(`activity:${JSON.stringify(options ?? {})}`, async () => {
      const resolved = await resolveOnce();
      return detectSpeechActivity(
        resolved.meta.file,
        resolved.meta.duration,
        options,
      );
    });

  node.transcribe = (options?: {
    refine?: boolean;
    noiseDb?: number;
    prompt?: string;
  }) =>
    memoize(
      `transcribe:${JSON.stringify(options ?? {})}`,
      async (): Promise<TranscriptionResult> => {
        const resolved = await resolveOnce();
        const nativeWords = resolved.meta.words;
        if (nativeWords && nativeWords.length > 0) {
          // Native ElevenLabs alignment — character-level accuracy, no
          // whisper call and no refinement needed.
          return { text: joinWords(nativeWords), words: nativeWords };
        }
        // Use the render-level transcription default (gateway whisper) when
        // available; falls back to direct Groq whisper-large-v3 inside
        // transcribeAudio() if neither is set.
        const model = getResolveContext()?.defaults?.transcription;
        const raw = await transcribeAudio(resolved.meta.file, {
          cache: getActiveCache(),
          ...(model ? { model } : {}),
          ...(options?.prompt ? { prompt: options.prompt } : {}),
        });

        // Align whisper boundary words to measured VOICE activity
        // (default on). Whisper's attention absorbs leading ambience into
        // the first word and stretches the last toward EOF; broadband
        // silencedetect can't tell footsteps from speech. A voice-band
        // (200-3400 Hz) activity signal can: leading words placed wholly
        // inside ambience are pushed to the voice onset, the last word is
        // clamped to the voice offset. monotonizeEntries downstream
        // cascades the shift. Applied on top of the disk cache — the raw
        // transcript stays the cached source of truth. Falls back to
        // broadband silence refinement when bandpass detection fails, and
        // to raw timings when no ffmpeg is available.
        if (options?.refine === false || raw.words.length === 0) return raw;
        try {
          const activity = await detectActivityOnce({
            ...(options?.noiseDb !== undefined
              ? { noiseDb: options.noiseDb }
              : {}),
          });
          if (activity.length > 0) {
            return {
              text: raw.text,
              words: alignWordsToActivity(raw.words, activity),
            };
          }
          // Empty activity (voice below threshold): broadband fallback.
          const silences = await detectSilenceOnce({
            noiseDb: options?.noiseDb ?? -35,
          });
          return {
            text: raw.text,
            words: refineWordTimings(
              raw.words,
              silences,
              resolved.meta.duration,
            ),
          };
        } catch {
          // ffmpeg unavailable (e.g. cloud backend) — raw timings are
          // still correct transcription, just unrefined.
          return raw;
        }
      },
    );

  node.silenceSegments = (options?: SilenceDetectOptions) =>
    detectSilenceOnce(options);

  node.range = (options?: SilenceDetectOptions): Promise<TimeRange> =>
    memoize(`range:${JSON.stringify(options ?? {})}`, async () => {
      const resolved = await resolveOnce();
      const silences = await detectSilenceOnce(options);
      return computeSoundBounds(silences, resolved.meta.duration);
    });

  node.speechRange = (options?: {
    pad?: number;
    refine?: boolean;
    noiseDb?: number;
  }): Promise<TimeRange | null> =>
    memoize(`speechRange:${JSON.stringify(options ?? {})}`, async () => {
      const resolved = await resolveOnce();
      const { words } = await node.transcribe({
        ...(options?.refine !== undefined ? { refine: options.refine } : {}),
        ...(options?.noiseDb !== undefined ? { noiseDb: options.noiseDb } : {}),
      });
      if (!words || words.length === 0) return null;

      const pad = options?.pad ?? 0;
      const first = words[0]!;
      const last = words[words.length - 1]!;
      const duration = resolved.meta.duration;
      return {
        start: Math.max(0, first.start - pad),
        end: duration > 0 ? Math.min(duration, last.end + pad) : last.end + pad,
      };
    });

  // Sync convenience getters — populated when meta is pre-seeded (resolved
  // parent) or after the node has been awaited.
  Object.defineProperties(node, {
    duration: {
      get() {
        return element.meta?.duration ?? 0;
      },
      enumerable: false,
    },
    words: {
      get() {
        return element.meta?.words;
      },
      enumerable: false,
    },
  });

  return node;
}

function joinWords(words: WordTiming[]): string {
  return words.map((w) => w.word).join(" ");
}
