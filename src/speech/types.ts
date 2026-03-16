import type { File } from "../ai-sdk/file";

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
 * A segment of speech corresponding to one entry in the `children` array.
 *
 * Each segment carries start/end timestamps relative to the full audio track
 * and a lazy `.audio()` method that extracts just that segment's bytes via ffmpeg.
 */
export interface Segment {
  /** The original text for this segment. */
  text: string;
  /** Start time in seconds (relative to full audio). */
  start: number;
  /** End time in seconds (relative to full audio). */
  end: number;
  /** Duration in seconds (convenience: `end - start`). */
  duration: number;
  /**
   * Extract this segment's audio as a standalone Uint8Array.
   * Uses ffmpeg to slice the full audio at [start, end].
   * The result is cached after the first call.
   */
  audio: () => Promise<Uint8Array>;
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
 * Result of speech generation with timing data.
 */
export interface SpeechWithTimings {
  /** Raw audio bytes (decoded from base64). */
  audio: Uint8Array;
  /** Word-level timing data parsed from character alignment. */
  words: WordTiming[];
  /** Total audio duration in seconds (from alignment end time). */
  duration: number;
}

/**
 * Internal representation used to create Segment objects.
 * Carries the full audio File reference needed for lazy slicing.
 */
export interface SegmentDescriptor {
  text: string;
  start: number;
  end: number;
  duration: number;
}
