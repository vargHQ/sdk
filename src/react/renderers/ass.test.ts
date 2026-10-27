import { describe, expect, test } from "bun:test";
import {
  convertSrtToAss,
  convertSrtToAssGrouped,
  monotonizeEntries,
  type SubtitleStyle,
} from "./ass";

const STYLE: SubtitleStyle = {
  fontName: "Arial",
  fontSize: 64,
  primaryColor: "&H00FFFFFF",
  outlineColor: "&H00000000",
  backColor: "&H00000000",
  bold: false,
  outline: 2,
  shadow: 0,
  alignment: 2,
  marginV: 10,
};

/** The ep5 incident shape: whisper emitted "can't" starting BEFORE the
 *  previous words ended (3.18 < 3.56/3.72), producing two stacked caption
 *  lines on screen. Real timings from /tmp/varg-captions-1784659084338.srt. */
const EP5_WORDS = [
  { start: 3.14, end: 3.279, text: "be" },
  { start: 3.279, end: 3.56, text: "honest" },
  { start: 3.56, end: 3.72, text: "I" },
  { start: 3.18, end: 3.96, text: "can't" }, // ← overlaps the previous two
  { start: 3.96, end: 4.139, text: "get" },
];

function toSrt(words: { start: number; end: number; text: string }[]): string {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const ms = Math.round((t % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };
  return words
    .map((w, i) => `${i + 1}\n${fmt(w.start)} --> ${fmt(w.end)}\n${w.text}`)
    .join("\n\n");
}

function parseDialogueTimes(ass: string): Array<[number, number]> {
  const t = (ts: string) => {
    const [h, m, s] = ts.split(":");
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  };
  return [...ass.matchAll(/^Dialogue:\s*\d+,([\d:.]+),([\d:.]+),/gm)].map(
    (m) => [t(m[1]!), t(m[2]!)],
  );
}

function assertNoOverlaps(times: Array<[number, number]>) {
  const sorted = [...times].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i]![0]).toBeGreaterThanOrEqual(sorted[i - 1]![1] - 1e-9);
  }
}

describe("monotonizeEntries", () => {
  test("passes through already-monotonic entries unchanged", () => {
    const entries = [
      { index: 1, start: 0, end: 0.5, text: "a" },
      { index: 2, start: 0.5, end: 1.0, text: "b" },
    ];
    expect(monotonizeEntries(entries)).toEqual(entries);
  });

  test("clamps a start that precedes the previous end (ep5 shape)", () => {
    const entries = EP5_WORDS.map((w, i) => ({ index: i, ...w }));
    const fixed = monotonizeEntries(entries);
    // "can't" start clamped from 3.18 to "I".end (3.72)
    expect(fixed[3]!.start).toBeCloseTo(3.72, 5);
    expect(fixed[3]!.end).toBeCloseTo(3.96, 5);
    // Strictly monotonic overall
    for (let i = 1; i < fixed.length; i++) {
      expect(fixed[i]!.start).toBeGreaterThanOrEqual(fixed[i - 1]!.end);
    }
  });

  test("clamps end to start when a cue collapses entirely", () => {
    const entries = [
      { index: 1, start: 0, end: 2.0, text: "long" },
      { index: 2, start: 0.5, end: 1.0, text: "swallowed" },
      { index: 3, start: 2.5, end: 3.0, text: "after" },
    ];
    const fixed = monotonizeEntries(entries);
    // "swallowed" collapses to zero-length at 2.0 rather than going negative
    expect(fixed[1]!.start).toBe(2.0);
    expect(fixed[1]!.end).toBe(2.0);
    // Later entries unaffected
    expect(fixed[2]!.start).toBe(2.5);
  });

  test("does not mutate the input", () => {
    const entries = [{ index: 1, start: 1, end: 0.5, text: "x" }];
    monotonizeEntries(entries);
    expect(entries[0]!.end).toBe(0.5);
  });
});

describe("convertSrtToAssGrouped with overlapping whisper timings", () => {
  test("ep5 shape produces no overlapping Dialogue events", () => {
    const { ass } = convertSrtToAssGrouped(
      toSrt(EP5_WORDS),
      STYLE,
      1080,
      1920,
      3,
      "&H35E6A3",
    );
    assertNoOverlaps(parseDialogueTimes(ass));
  });

  test("without activeColor (plain groups) also stays non-overlapping", () => {
    const { ass } = convertSrtToAssGrouped(
      toSrt(EP5_WORDS),
      STYLE,
      1080,
      1920,
      3,
    );
    assertNoOverlaps(parseDialogueTimes(ass));
  });
});

describe("convertSrtToAss with overlapping timings", () => {
  test("no overlapping Dialogue events", () => {
    const { ass } = convertSrtToAss(toSrt(EP5_WORDS), STYLE, 1080, 1920);
    assertNoOverlaps(parseDialogueTimes(ass));
  });
});
