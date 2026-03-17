import type { ResolvedElement } from "../react/resolved-element";

/**
 * Word-level timing from ElevenLabs character alignment.
 * Derived by grouping characters between whitespace boundaries.
 */
export interface WordTiming {
  /** The word text (no surrounding whitespace). */
  word: string;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
}

/**
 * A speech segment — a `ResolvedElement<"speech">` with timing metadata.
 *
 * Each segment is a real ResolvedElement instance, so it works everywhere
 * a speech element is accepted: as a Clip child, Video audio input,
 * Captions source, etc.
 *
 * Created by `await Speech({ children: ["s1", "s2", ...] })`.
 *
 * @example
 * ```tsx
 * const { segments } = await Speech({
 *   children: ["Welcome.", "Main content.", "Thanks."],
 *   model: elevenlabs.speechModel("eleven_v3"),
 *   voice: "adam",
 * });
 *
 * // As clip child (plays audio)
 * <Clip duration={segments[0].duration}>{segments[0]}</Clip>
 *
 * // As video audio input (for lipsync)
 * Video({ prompt: { audio: segments[0] } })
 * ```
 */
export type Segment = ResolvedElement<"speech"> & {
  /** The original text for this segment. */
  readonly text: string;
  /** Start time in seconds (relative to full audio). */
  readonly start: number;
  /** End time in seconds (relative to full audio). */
  readonly end: number;
};

/**
 * Raw character-level alignment returned by ElevenLabs
 * `POST /v1/text-to-speech/{voice_id}/with-timestamps`.
 */
export interface ElevenLabsCharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/**
 * Full response from ElevenLabs `/with-timestamps` endpoint.
 */
export interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment?: ElevenLabsCharacterAlignment;
  normalized_alignment?: ElevenLabsCharacterAlignment;
}

/**
 * Internal representation used before creating Segment objects.
 */
export interface SegmentDescriptor {
  text: string;
  start: number;
  end: number;
  duration: number;
}
