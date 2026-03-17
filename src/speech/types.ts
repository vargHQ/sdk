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
 * A segment of speech audio — a `Uint8Array` of MP3 bytes with timing metadata.
 *
 * Because `Segment extends Uint8Array`, it can be passed directly anywhere
 * audio bytes are expected (e.g., `Video({ prompt: { audio: segments[0] } })`).
 *
 * Created by `await Speech({ children: ["s1", "s2", ...] })`.
 */
export interface Segment extends Uint8Array {
  /** The original text for this segment. */
  readonly text: string;
  /** Start time in seconds (relative to full audio). */
  readonly start: number;
  /** End time in seconds (relative to full audio). */
  readonly end: number;
  /** Duration in seconds (convenience: `end - start`). */
  readonly duration: number;
}

/**
 * Create a Segment: a Uint8Array of audio bytes decorated with timing metadata.
 */
export function createSegment(
  audioBytes: Uint8Array,
  meta: { text: string; start: number; end: number; duration: number },
): Segment {
  const segment = new Uint8Array(audioBytes) as Segment;
  Object.defineProperties(segment, {
    text: { value: meta.text, enumerable: true },
    start: { value: meta.start, enumerable: true },
    end: { value: meta.end, enumerable: true },
    duration: { value: meta.duration, enumerable: true },
  });
  return segment;
}

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
 * Internal representation used to create Segment objects.
 */
export interface SegmentDescriptor {
  text: string;
  start: number;
  end: number;
  duration: number;
}
