/**
 * Voice-activity detection + word alignment — the speechRange v2 core.
 *
 * ep5 incident, part 4: broadband silencedetect can't tell footsteps from
 * speech, and whisper's boundary words are attention artifacts (clip 4:
 * "If" lasting 0.05s at 0.75 while the voice actually starts ~1.65).
 * Bandpassed (200-3400 Hz) activity measures WHEN there is voice;
 * alignWordsToActivity pushes/clamps boundary words to it.
 */

import { describe, expect, test } from "bun:test";
import {
  alignWordsToActivity,
  invertSilences,
  mergeActivity,
} from "../primitives/speech-activity";

describe("invertSilences", () => {
  test("no silences — whole duration is active", () => {
    expect(invertSilences([], 6)).toEqual([{ start: 0, end: 6 }]);
  });

  test("leading + trailing silence yields middle activity", () => {
    expect(
      invertSilences(
        [
          { start: 0, end: 0.9 },
          { start: 5.5, end: 6 },
        ],
        6,
      ),
    ).toEqual([{ start: 0.9, end: 5.5 }]);
  });

  test("mid silences split activity", () => {
    expect(
      invertSilences(
        [
          { start: 1, end: 2 },
          { start: 4, end: 4.5 },
        ],
        6,
      ),
    ).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 4 },
      { start: 4.5, end: 6 },
    ]);
  });

  test("overlapping/unsorted silences are handled", () => {
    expect(
      invertSilences(
        [
          { start: 3, end: 5 },
          { start: 0, end: 1 },
          { start: 0.5, end: 1.5 },
        ],
        6,
      ),
    ).toEqual([
      { start: 1.5, end: 3 },
      { start: 5, end: 6 },
    ]);
  });
});

describe("mergeActivity", () => {
  test("merges intervals with small gaps (inter-word pauses)", () => {
    expect(
      mergeActivity(
        [
          { start: 1, end: 2 },
          { start: 2.2, end: 3 },
          { start: 4.5, end: 5 },
        ],
        0.3,
        0.1,
      ),
    ).toEqual([
      { start: 1, end: 3 },
      { start: 4.5, end: 5 },
    ]);
  });

  test("drops residual noise bursts shorter than minActivity", () => {
    // The ep5 clip-1 shape: footstep blips between silences, then voice.
    expect(
      mergeActivity(
        [
          { start: 0.4, end: 0.45 }, // footstep
          { start: 0.92, end: 5.8 }, // voice
        ],
        0.3,
        0.1,
      ),
    ).toEqual([{ start: 0.92, end: 5.8 }]);
  });

  test("empty input", () => {
    expect(mergeActivity([], 0.3, 0.1)).toEqual([]);
  });
});

describe("alignWordsToActivity", () => {
  test("ep5 clip 1: leading ambience absorbed into first word gets clamped", () => {
    // Whisper: "I" 0.40-0.66 (refined earlier but still early); voice
    // activity actually starts at 0.92.
    const words = [
      { word: "I", start: 0.4, end: 0.66 },
      { word: "really", start: 0.66, end: 1.62 },
      { word: "love", start: 1.62, end: 1.96 },
    ];
    const aligned = alignWordsToActivity(words, [{ start: 0.92, end: 5.8 }]);
    // "I" lies wholly before onset -> pushed to onset preserving duration
    expect(aligned[0]!.start).toBeCloseTo(0.92, 5);
    expect(aligned[0]!.end).toBeCloseTo(0.92 + 0.26, 5);
    // "really" also starts before onset (0.66 < 0.92) — its start is
    // clamped to onset; its end and all later words stay untouched.
    expect(aligned[1]!.start).toBeCloseTo(0.92, 5);
    expect(aligned[1]!.end).toBe(1.62);
    expect(aligned[2]).toEqual(words[2]!);
  });

  test("ep5 clip 4: tiny boundary word wholly inside ambience is pushed", () => {
    // Whisper: "If" 0.75-0.80 (0.05s!), "you" 0.80-2.32; voice starts ~1.65.
    const words = [
      { word: "If", start: 0.75, end: 0.8 },
      { word: "you", start: 0.8, end: 2.32 },
      { word: "can't", start: 2.32, end: 2.7 },
    ];
    const aligned = alignWordsToActivity(words, [{ start: 1.65, end: 6.5 }]);
    expect(aligned[0]!.start).toBeCloseTo(1.65, 5);
    expect(aligned[0]!.end).toBeCloseTo(1.7, 5);
    // "you" reaches into activity — start clamped to onset, not pushed
    expect(aligned[1]!.start).toBeCloseTo(1.65, 5);
    expect(aligned[1]!.end).toBe(2.32);
  });

  test("last word stretched toward EOF is clamped to voice offset", () => {
    const words = [{ word: "done", start: 4.0, end: 6.0 }];
    const aligned = alignWordsToActivity(words, [{ start: 4.0, end: 4.7 }]);
    expect(aligned[0]!.end).toBeCloseTo(4.7, 5);
  });

  test("empty activity — words unchanged (never worse than whisper)", () => {
    const words = [{ word: "hi", start: 0, end: 0.5 }];
    expect(alignWordsToActivity(words, [])).toEqual(words);
  });

  test("words already inside activity are untouched", () => {
    const words = [
      { word: "hello", start: 1.0, end: 1.4 },
      { word: "world", start: 1.4, end: 1.9 },
    ];
    const aligned = alignWordsToActivity(words, [{ start: 0.9, end: 2.0 }]);
    expect(aligned).toEqual(words);
  });

  test("does not mutate input", () => {
    const words = [{ word: "I", start: 0.4, end: 0.66 }];
    alignWordsToActivity(words, [{ start: 0.92, end: 5.8 }]);
    expect(words[0]!.start).toBe(0.4);
  });
});
