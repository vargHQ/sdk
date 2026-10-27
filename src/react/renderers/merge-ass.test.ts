import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { mergeAssFiles, shiftAssTimestamps, transformCue } from "./merge-ass";

// ---------------------------------------------------------------------------
// transformCue — the single shift/drop/clamp primitive
// ---------------------------------------------------------------------------
describe("transformCue", () => {
  test("no window: plain shift by timeOffset (legacy behavior)", () => {
    expect(transformCue(1, 2, 10)).toEqual({ start: 11, end: 12 });
    expect(transformCue(0, 0.5, 0)).toEqual({ start: 0, end: 0.5 });
  });

  test("window with cutFrom: shift = timeOffset - cutFrom", () => {
    // Clip trimmed to start at 0.8s of raw media, placed at 10s on timeline.
    // A cue at raw 1.0-2.0 shows at timeline 10.2-11.2.
    const cue = transformCue(1.0, 2.0, 10, { cutFrom: 0.8 });
    expect(cue!.start).toBeCloseTo(10.2, 5);
    expect(cue!.end).toBeCloseTo(11.2, 5);
  });

  test("drops cue entirely before cutFrom", () => {
    expect(transformCue(0.1, 0.7, 10, { cutFrom: 0.8 })).toBeNull();
  });

  test("drops cue entirely after cutTo", () => {
    expect(transformCue(5.6, 6.0, 10, { cutFrom: 0.8, cutTo: 5.5 })).toBeNull();
  });

  test("clamps cue partially before cutFrom", () => {
    // Raw cue 0.5-1.5, window starts at 0.8 → visible part 0.8-1.5,
    // re-based to timeline 10 → 10-10.7.
    const cue = transformCue(0.5, 1.5, 10, { cutFrom: 0.8 });
    expect(cue!.start).toBeCloseTo(10, 5);
    expect(cue!.end).toBeCloseTo(10.7, 5);
  });

  test("clamps cue partially after cutTo — end never exceeds clip end", () => {
    // Whisper's trailing word often ends after our cutTo. Raw cue 5.0-5.9,
    // window [0.8, 5.5] at offset 10 → clamped to raw 5.0-5.5 →
    // timeline 14.2-14.7. Clip on timeline spans [10, 14.7] — no bleed
    // into the next clip.
    const cue = transformCue(5.0, 5.9, 10, { cutFrom: 0.8, cutTo: 5.5 });
    expect(cue!.start).toBeCloseTo(14.2, 5);
    expect(cue!.end).toBeCloseTo(14.7, 5);
  });

  test("cutTo derived from cutFrom + duration when cutTo absent", () => {
    const cue = transformCue(3.9, 4.6, 0, { cutFrom: 0.5, duration: 4 });
    // Window is [0.5, 4.5]: cue clamps to 3.9-4.5, shift = -0.5
    expect(cue!.start).toBeCloseTo(3.4, 5);
    expect(cue!.end).toBeCloseTo(4.0, 5);
  });

  test("drops zero-width cue after clamping", () => {
    expect(transformCue(5.5, 5.9, 0, { cutFrom: 0, cutTo: 5.5 })).toBeNull();
  });

  test("adjacent clips never overlap after clamping", () => {
    // Clip A: raw window [0.2, 5.6], timeline offset 0 → spans [0, 5.4]
    // Clip B: raw window [0.1, 3.0], timeline offset 5.4
    // Whisper tail cue in A (5.3-6.1) must clamp to end ≤ 5.4.
    const tailA = transformCue(5.3, 6.1, 0, { cutFrom: 0.2, cutTo: 5.6 });
    const headB = transformCue(0.1, 0.9, 5.4, { cutFrom: 0.1, cutTo: 3.0 });
    expect(tailA!.end).toBeCloseTo(5.4, 5);
    expect(headB!.start).toBeCloseTo(5.4, 5);
    expect(tailA!.end).toBeLessThanOrEqual(headB!.start + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// File-level helpers
// ---------------------------------------------------------------------------
const ASS_HEADER = `[Script Info]
Title: Test
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

function writeAss(dialogues: string[]): string {
  const path = `/tmp/varg-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ass`;
  writeFileSync(path, ASS_HEADER + dialogues.join("\n") + "\n");
  return path;
}

function dialogueTimes(content: string): Array<[string, string]> {
  return [...content.matchAll(/^Dialogue:\s*\d+,([^,]+),([^,]+),/gm)].map(
    (m) => [m[1]!, m[2]!],
  );
}

describe("shiftAssTimestamps", () => {
  test("plain offset without window (legacy)", () => {
    const src = writeAss([
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,hello",
    ]);
    const out = shiftAssTimestamps(src, 10);
    const times = dialogueTimes(readFileSync(out, "utf-8"));
    expect(times).toEqual([["0:00:11.00", "0:00:12.00"]]);
  });

  test("window: rebases by cutFrom and drops out-of-window cues", () => {
    const src = writeAss([
      "Dialogue: 0,0:00:00.10,0:00:00.70,Default,,0,0,0,,dropped-before",
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,kept",
      "Dialogue: 0,0:00:05.60,0:00:06.00,Default,,0,0,0,,dropped-after",
    ]);
    const out = shiftAssTimestamps(src, 10, { cutFrom: 0.8, cutTo: 5.5 });
    const content = readFileSync(out, "utf-8");
    const times = dialogueTimes(content);
    expect(times).toEqual([["0:00:10.20", "0:00:11.20"]]);
    expect(content).toContain("kept");
    expect(content).not.toContain("dropped-before");
    expect(content).not.toContain("dropped-after");
  });

  test("window: clamps whisper tail to cutTo", () => {
    const src = writeAss([
      "Dialogue: 0,0:00:05.00,0:00:05.90,Default,,0,0,0,,tail",
    ]);
    const out = shiftAssTimestamps(src, 10, { cutFrom: 0.8, cutTo: 5.5 });
    const times = dialogueTimes(readFileSync(out, "utf-8"));
    expect(times).toEqual([["0:00:14.20", "0:00:14.70"]]);
  });
});

describe("mergeAssFiles", () => {
  test("plain merge without windows (legacy behavior preserved)", () => {
    const a = writeAss([
      "Dialogue: 0,0:00:00.50,0:00:01.50,Default,,0,0,0,,first",
    ]);
    const b = writeAss([
      "Dialogue: 0,0:00:00.20,0:00:01.00,Default,,0,0,0,,second",
    ]);
    const out = mergeAssFiles(
      [
        { assPath: a, timeOffset: 0, styleSuffix: "_0" },
        { assPath: b, timeOffset: 6, styleSuffix: "_1" },
      ],
      1080,
      1920,
    );
    const content = readFileSync(out, "utf-8");
    const times = dialogueTimes(content);
    expect(times).toEqual([
      ["0:00:00.50", "0:00:01.50"],
      ["0:00:06.20", "0:00:07.00"],
    ]);
    expect(content).toContain("Default_0");
    expect(content).toContain("Default_1");
  });

  test("windows: rebase + no overlap at clip boundary", () => {
    // Clip A: window [0.2, 5.6] at offset 0 → timeline [0, 5.4]
    // Clip B: window [0.1, 3.0] at offset 5.4 → timeline [5.4, 8.3]
    // A has a whisper tail cue ending past cutTo — the ep5 double-line bug.
    const a = writeAss([
      "Dialogue: 0,0:00:00.50,0:00:02.00,Default,,0,0,0,,a-body",
      "Dialogue: 0,0:00:05.30,0:00:06.10,Default,,0,0,0,,a-tail",
    ]);
    const b = writeAss([
      "Dialogue: 0,0:00:00.10,0:00:00.90,Default,,0,0,0,,b-head",
    ]);
    const out = mergeAssFiles(
      [
        {
          assPath: a,
          timeOffset: 0,
          styleSuffix: "_0",
          window: { cutFrom: 0.2, cutTo: 5.6 },
        },
        {
          assPath: b,
          timeOffset: 5.4,
          styleSuffix: "_1",
          window: { cutFrom: 0.1, cutTo: 3.0 },
        },
      ],
      1080,
      1920,
    );
    const content = readFileSync(out, "utf-8");
    const times = dialogueTimes(content);
    // a-body: 0.5-2.0 shifted by -0.2 → 0.3-1.8
    // a-tail: clamped to 5.6, shifted by -0.2 → 5.1-5.4
    // b-head: 0.1-0.9 shifted by 5.4-0.1=5.3 → 5.4-6.2
    expect(times).toEqual([
      ["0:00:00.30", "0:00:01.80"],
      ["0:00:05.10", "0:00:05.40"],
      ["0:00:05.40", "0:00:06.20"],
    ]);
    // No overlap: a-tail end (5.4) ≤ b-head start (5.4)
  });

  test("windows: drops cues outside, keeps clips without window untouched", () => {
    const a = writeAss([
      "Dialogue: 0,0:00:00.10,0:00:00.60,Default,,0,0,0,,dropped",
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,kept-a",
    ]);
    const b = writeAss([
      "Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,kept-b",
    ]);
    const out = mergeAssFiles(
      [
        {
          assPath: a,
          timeOffset: 0,
          styleSuffix: "_0",
          window: { cutFrom: 0.8, duration: 4 },
        },
        // No window — legacy plain shift
        { assPath: b, timeOffset: 4, styleSuffix: "_1" },
      ],
      1080,
      1920,
    );
    const content = readFileSync(out, "utf-8");
    expect(content).not.toContain("dropped");
    const times = dialogueTimes(content);
    expect(times).toEqual([
      ["0:00:00.20", "0:00:01.20"],
      ["0:00:04.00", "0:00:05.00"],
    ]);
  });
});

describe("uniqueTempPath (regression: Date.now collision)", () => {
  test("rapid successive calls never collide", async () => {
    const { uniqueTempPath } = await import("./utils");
    // Memoized transcripts made 12 caption conversions land in the same
    // millisecond — Date.now()-only paths collided (12 clips -> 7 files)
    // and clips displayed each other's captions.
    const paths = new Set<string>();
    for (let i = 0; i < 100; i++) {
      paths.add(uniqueTempPath("varg-captions", "ass"));
    }
    expect(paths.size).toBe(100);
  });
});
