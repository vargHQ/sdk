/**
 * Word-timing refinement + AudioNode analysis memoization.
 *
 * The ep5 incident, part 3: whisper absorbed ~0.9s of leading ambience
 * (footsteps, birds) into the first word — "I" got start=0.000, so
 * captions appeared before anyone spoke AND speechRange-based auto-trim
 * kept the silent lead-in (cutFrom = 0). refineWordTimings clamps the
 * first/last word against ffmpeg-measured silence; AudioNode memoizes
 * every analysis so all consumers share one transcription + one
 * silencedetect run.
 */

import { describe, expect, test } from "bun:test";
import { File } from "../../ai-sdk/file";
import { Speech } from "../elements";
import { refineWordTimings } from "../primitives/silence";
import { ResolvedElement } from "../resolved-element";

// ---------------------------------------------------------------------------
// refineWordTimings — pure unit tests
// ---------------------------------------------------------------------------
describe("refineWordTimings", () => {
  // The ep5 shape: speech actually starts ~0.87s in, whisper said 0.000.
  const EP5_WORDS = [
    { word: "I", start: 0.0, end: 0.66 },
    { word: "really", start: 0.66, end: 1.62 },
    { word: "love", start: 1.62, end: 1.96 },
  ];

  test("leading silence clamps the first word's start (ep5 shape)", () => {
    const refined = refineWordTimings(
      EP5_WORDS,
      [{ start: 0, end: 0.87 }], // measured leading silence
      6,
    );
    expect(refined[0]!.start).toBeCloseTo(0.66 - 0.05, 5); // min(0.87, end-minWord)
    // Middle words untouched
    expect(refined[1]).toEqual(EP5_WORDS[1]!);
    expect(refined[2]).toEqual(EP5_WORDS[2]!);
  });

  test("first word keeps minWordDuration when silence covers it entirely", () => {
    const refined = refineWordTimings(
      [{ word: "hey", start: 0.0, end: 0.3 }],
      [{ start: 0, end: 0.9 }],
      6,
    );
    // start clamped to end - 0.05, not to 0.9 (word must survive)
    expect(refined[0]!.start).toBeCloseTo(0.25, 5);
    expect(refined[0]!.end).toBe(0.3);
  });

  test("trailing silence clamps the last word's end", () => {
    const words = [
      { word: "done", start: 4.0, end: 6.0 }, // stretched to EOF by whisper
    ];
    const refined = refineWordTimings(words, [{ start: 4.6, end: 6.0 }], 6);
    expect(refined[0]!.end).toBeCloseTo(4.6, 5);
    expect(refined[0]!.start).toBe(4.0);
  });

  test("no leading/trailing silence — no-op", () => {
    const words = [{ word: "hi", start: 0.1, end: 0.5 }];
    // Mid-clip silence only
    const refined = refineWordTimings(words, [{ start: 2, end: 3 }], 6);
    expect(refined).toEqual(words);
  });

  test("empty inputs are safe", () => {
    expect(refineWordTimings([], [{ start: 0, end: 1 }], 6)).toEqual([]);
    const words = [{ word: "a", start: 0, end: 1 }];
    expect(refineWordTimings(words, [], 6)).toEqual(words);
  });

  test("does not mutate input", () => {
    const words = [{ word: "I", start: 0.0, end: 0.66 }];
    refineWordTimings(words, [{ start: 0, end: 0.5 }], 6);
    expect(words[0]!.start).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// AudioNode analysis memoization
// ---------------------------------------------------------------------------
function makeResolvedSpeech(
  words?: { word: string; start: number; end: number }[],
) {
  const speech = Speech({ voice: "adam", children: "hello" });
  const file = File.fromGenerated({
    uint8Array: new Uint8Array([0, 1, 2, 3]),
    mediaType: "audio/mpeg",
  });
  return new ResolvedElement(speech, { file, duration: 3, words });
}

describe("AudioNode analysis memoization", () => {
  test("repeated speechRange() calls return the same promise", () => {
    const audio = makeResolvedSpeech([
      { word: "hi", start: 0.2, end: 0.6 },
    ]).audio;
    const a = audio.speechRange({ pad: 0.15 });
    const b = audio.speechRange({ pad: 0.15 });
    expect(a).toBe(b);
  });

  test("different options produce independent memo entries", () => {
    const audio = makeResolvedSpeech([
      { word: "hi", start: 0.2, end: 0.6 },
    ]).audio;
    const a = audio.speechRange({ pad: 0.15 });
    const b = audio.speechRange({ pad: 0.3 });
    expect(a).not.toBe(b);
  });

  test("transcribe() is memoized and shared with speechRange()", async () => {
    const audio = makeResolvedSpeech([
      { word: "hello", start: 0.42, end: 0.9 },
      { word: "world", start: 1.0, end: 2.31 },
    ]).audio;

    const t1 = audio.transcribe();
    const t2 = audio.transcribe();
    expect(t1).toBe(t2);

    // Native words path: no whisper, no silencedetect — range comes straight
    // from the shared transcript.
    const range = await audio.speechRange();
    expect(range).toEqual({ start: 0.42, end: 2.31 });
  });

  test("native ElevenLabs words are never refined (trusted alignment)", async () => {
    // Native words legitimately start at 0 (TTS starts speaking at once).
    const audio = makeResolvedSpeech([
      { word: "hello", start: 0.0, end: 0.5 },
    ]).audio;
    const { words } = await audio.transcribe();
    expect(words[0]!.start).toBe(0.0);
  });
});
