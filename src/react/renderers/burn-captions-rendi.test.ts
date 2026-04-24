/**
 * Rendi E2E tests for caption burning.
 *
 * Tests burnCaptions() through the Rendi cloud backend across scenarios:
 * 1. Plain captions (no custom fonts, no emoji)
 * 2. Captions with custom font (compressed folder mode)
 * 3. English text + emoji (filterComplex + compressed folder)
 * 4. Japanese text + emoji (multi-font CJK + emoji)
 * 5. Arabic text + emoji (RTL baseline)
 *
 * Requires env vars: RENDI_API_KEY, FAL_KEY, RENDI_INTEGRATION_TESTS=1
 *
 * NOTE: Rendi free tier has 4 commands/min rate limit. Run tests individually:
 *   RENDI_INTEGRATION_TESTS=1 bun test src/react/renderers/burn-captions-rendi.test.ts -t "plain"
 */

import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { $ } from "bun";
import { r2Storage } from "@/ai-sdk/storage/r2";
import { createRendiBackend } from "@/ai-sdk/providers/editly/rendi";
import type { FFmpegOutput } from "@/ai-sdk/providers/editly/backends/types";
import {
  burnCaptions,
  ensureLocalFonts,
  type CaptionFontFile,
} from "./burn-captions";
import {
  type EmojiOverlay,
  extractEmoji,
  stripEmoji,
  calculateEmojiSize,
  calculateEmojiY,
} from "./emoji";
import {
  getFontMetrics,
  getSpaceWidth,
  getCharXPositions,
  parseASSSegments,
  type FontPathMap,
} from "./text-measure";
import { resolveFonts } from "./fonts";

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

const shouldRun =
  !!process.env.RENDI_INTEGRATION_TESTS && !!process.env.RENDI_API_KEY;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_VIDEO = "https://s3.varg.ai/test-media/sora-landscape.mp4";
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const OUTPUT_DIR = "output/rendi";

// Font definitions (matching what's on S3)
const MONTSERRAT: CaptionFontFile = {
  url: "https://s3.varg.ai/fonts/Montserrat-Bold.ttf",
  fileName: "Montserrat-Bold.ttf",
};
const NOTO_CJK_JP: CaptionFontFile = {
  url: "https://s3.varg.ai/fonts/NotoSansCJKjp-Bold.otf",
  fileName: "NotoSansCJKjp-Bold.otf",
};
const NOTO_ARABIC: CaptionFontFile = {
  url: "https://s3.varg.ai/fonts/NotoSansArabic-Bold.ttf",
  fileName: "NotoSansArabic-Bold.ttf",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const storage = shouldRun ? r2Storage() : (null as never);
const rendiBackend = shouldRun
  ? createRendiBackend({ storage })
  : (null as never);

/** Generate an ASS file with given style and dialogue lines. */
function makeASS(opts: {
  fontName: string;
  fontSize: number;
  alignment: number;
  marginV: number;
  dialogues: { start: string; end: string; text: string }[];
}): string {
  const { fontName, fontSize, alignment, marginV, dialogues } = opts;
  let ass = `[Script Info]
Title: Rendi Caption Test
ScriptType: v4.00+
PlayResX: ${VIDEO_WIDTH}
PlayResY: ${VIDEO_HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,1,${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const d of dialogues) {
    ass += `Dialogue: 0,${d.start},${d.end},Default,,0,0,0,,${d.text}\n`;
  }

  return ass;
}

/** Write ASS to a temp file and return the path. */
function writeASS(name: string, content: string): string {
  const path = `/tmp/varg-rendi-test-${name}-${Date.now()}.ass`;
  writeFileSync(path, content);
  return path;
}

/** Download a Rendi URL result and save to output dir. */
async function saveResult(output: FFmpegOutput, outPath: string) {
  expect(output.type).toBe("url");
  if (output.type !== "url") return;
  expect(output.url).toMatch(/^https:\/\//);

  const res = await fetch(output.url);
  if (!res.ok) throw new Error(`Failed to download result: ${res.status}`);

  await $`mkdir -p ${OUTPUT_DIR}`.quiet();
  const bytes = await res.arrayBuffer();
  await Bun.write(outPath, bytes);

  const file = Bun.file(outPath);
  expect(await file.exists()).toBe(true);
  expect(file.size).toBeGreaterThan(0);
  console.log(`Output saved: ${outPath} (${(file.size / 1024).toFixed(0)} KB)`);
}

/**
 * Build EmojiOverlay[] for a line of text using the same logic as captions.ts.
 *
 * Steps:
 * 1. resolveFonts() to get font files + tagText function
 * 2. ensureLocalFonts() to download for measurement
 * 3. extractEmoji() and stripEmoji() to get emoji instances + stripped text
 * 4. tagText() on the stripped text to add {\fn} ASS tags
 * 5. parseASSSegments() to break tagged text into font segments
 * 6. getFontMetrics() + getSpaceWidth() for sizing
 * 7. getCharXPositions() for precise X positioning
 * 8. calculateEmojiSize() + calculateEmojiY() for size and Y
 */
async function buildEmojiOverlays(opts: {
  text: string;
  primaryFontId: string;
  fontSize: number;
  alignment: number;
  marginV: number;
  startTime: number;
  endTime: number;
}): Promise<{
  overlays: EmojiOverlay[];
  strippedTaggedText: string;
  fontResolution: ReturnType<typeof resolveFonts>;
  spacesPerEmoji: number;
}> {
  const { text, primaryFontId, fontSize, alignment, marginV, startTime, endTime } = opts;

  // Resolve fonts needed for this text
  const fontResolution = resolveFonts(text, primaryFontId);

  // Download fonts locally for measurement
  const localFontsDir = await ensureLocalFonts(
    fontResolution.fontFiles.map((f) => ({ url: f.url, fileName: f.fileName })),
  );

  // Build font path map
  const fontPathMap: FontPathMap = new Map();
  for (const f of fontResolution.fontFiles) {
    fontPathMap.set(f.fontName, `${localFontsDir}/${f.fileName}`);
  }

  // Get primary font metrics
  const primaryFontPath = fontPathMap.get(fontResolution.primary.fontName)!;
  const metrics = getFontMetrics(primaryFontPath, fontSize);
  const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_HEIGHT, VIDEO_HEIGHT);
  const spaceWidth = getSpaceWidth(primaryFontPath, fontSize);
  const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

  // Extract emoji instances (charIndex is in stripped-text coordinates)
  const emojiInstances = extractEmoji(text, spacesPerEmoji);

  // Strip emoji and tag with {\fn} override tags
  const strippedText = stripEmoji(text, spacesPerEmoji);
  const strippedTaggedText = fontResolution.tagText(strippedText);

  // Parse into segments and compute character X positions
  const segments = parseASSSegments(strippedTaggedText, fontResolution.primary.fontName);
  const charPositions = getCharXPositions(
    segments,
    fontPathMap,
    fontSize,
    VIDEO_WIDTH,
    alignment,
  );

  // Build overlay descriptors
  const overlays: EmojiOverlay[] = [];
  for (const instance of emojiInstances) {
    const firstSpaceX = charPositions[instance.charIndex] ?? 0;
    const lastSpaceIdx = Math.min(
      instance.charIndex + spacesPerEmoji - 1,
      charPositions.length - 1,
    );
    const lastSpaceX = charPositions[lastSpaceIdx] ?? firstSpaceX;
    const blockEndX = lastSpaceX + spaceWidth;
    const blockWidth = blockEndX - firstSpaceX;
    const x = Math.round(firstSpaceX + blockWidth / 2 - emojiSize / 2);

    const y = calculateEmojiY(
      alignment,
      marginV,
      metrics.winDescent,
      metrics.winAscent,
      metrics.capHeight,
      VIDEO_HEIGHT,
      VIDEO_HEIGHT,
    );

    overlays.push({
      url: instance.url,
      fileName: `${instance.codepoints}.png`,
      startTime,
      endTime,
      x,
      y,
      size: emojiSize,
    });
  }

  return { overlays, strippedTaggedText, fontResolution, spacesPerEmoji };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!shouldRun)("burnCaptions via Rendi", () => {
  test("plain captions without custom fonts", async () => {
    const assContent = makeASS({
      fontName: "Arial",
      fontSize: 48,
      alignment: 2,
      marginV: 40,
      dialogues: [
        { start: "0:00:00.00", end: "0:00:02.00", text: "Hello from Rendi" },
        { start: "0:00:02.00", end: "0:00:04.00", text: "Caption burning test" },
      ],
    });
    const assPath = writeASS("plain", assContent);

    const output = await burnCaptions({
      video: { type: "url", url: TEST_VIDEO },
      assPath,
      outputPath: `${OUTPUT_DIR}/captions-plain.mp4`,
      backend: rendiBackend,
      verbose: true,
    });

    await saveResult(output, `${OUTPUT_DIR}/captions-plain.mp4`);
  }, 120_000);

  test("captions with Montserrat font (compressed folder)", async () => {
    const assContent = makeASS({
      fontName: "Montserrat",
      fontSize: 56,
      alignment: 2,
      marginV: 50,
      dialogues: [
        { start: "0:00:00.00", end: "0:00:02.00", text: "Montserrat Bold" },
        { start: "0:00:02.00", end: "0:00:04.00", text: "Custom font via Rendi" },
      ],
    });
    const assPath = writeASS("font", assContent);

    const output = await burnCaptions({
      video: { type: "url", url: TEST_VIDEO },
      assPath,
      outputPath: `${OUTPUT_DIR}/captions-font.mp4`,
      backend: rendiBackend,
      verbose: true,
      fontFiles: [MONTSERRAT],
    });

    await saveResult(output, `${OUTPUT_DIR}/captions-font.mp4`);
  }, 120_000);

  test("English text + emoji overlay", async () => {
    const originalText = "Let's go 💪🔥 amazing";
    const fontSize = 56;
    const alignment = 2;
    const marginV = 50;

    const { overlays, strippedTaggedText, fontResolution } = await buildEmojiOverlays({
      text: originalText,
      primaryFontId: "montserrat",
      fontSize,
      alignment,
      marginV,
      startTime: 0,
      endTime: 4,
    });

    console.log(`[test] English emoji: ${overlays.length} overlays`);
    for (const o of overlays) {
      console.log(`  ${o.fileName}: x=${o.x}, y=${o.y}, size=${o.size}`);
    }

    const assContent = makeASS({
      fontName: fontResolution.primary.fontName,
      fontSize,
      alignment,
      marginV,
      dialogues: [
        { start: "0:00:00.00", end: "0:00:04.00", text: strippedTaggedText },
      ],
    });
    const assPath = writeASS("en-emoji", assContent);

    // Font files: primary only (no Noto Emoji since we overlay PNGs)
    const fontFiles = fontResolution.fontFiles
      .filter((f) => f.id !== "noto-emoji")
      .map((f) => ({ url: f.url, fileName: f.fileName }));

    const output = await burnCaptions({
      video: { type: "url", url: TEST_VIDEO },
      assPath,
      outputPath: `${OUTPUT_DIR}/captions-en-emoji.mp4`,
      backend: rendiBackend,
      verbose: true,
      fontFiles,
      emojiOverlays: overlays,
    });

    await saveResult(output, `${OUTPUT_DIR}/captions-en-emoji.mp4`);
  }, 180_000);

  test("Japanese text + emoji overlay (CJK multi-font)", async () => {
    const originalText = "すごい 💪 最高だ 🔥";
    const fontSize = 56;
    const alignment = 2;
    const marginV = 50;

    const { overlays, strippedTaggedText, fontResolution } = await buildEmojiOverlays({
      text: originalText,
      primaryFontId: "montserrat",
      fontSize,
      alignment,
      marginV,
      startTime: 0,
      endTime: 4,
    });

    console.log(`[test] Japanese emoji: ${overlays.length} overlays`);
    for (const o of overlays) {
      console.log(`  ${o.fileName}: x=${o.x}, y=${o.y}, size=${o.size}`);
    }

    const assContent = makeASS({
      fontName: fontResolution.primary.fontName,
      fontSize,
      alignment,
      marginV,
      dialogues: [
        { start: "0:00:00.00", end: "0:00:04.00", text: strippedTaggedText },
      ],
    });
    const assPath = writeASS("jp-emoji", assContent);

    const fontFiles = fontResolution.fontFiles
      .filter((f) => f.id !== "noto-emoji")
      .map((f) => ({ url: f.url, fileName: f.fileName }));

    const output = await burnCaptions({
      video: { type: "url", url: TEST_VIDEO },
      assPath,
      outputPath: `${OUTPUT_DIR}/captions-jp-emoji.mp4`,
      backend: rendiBackend,
      verbose: true,
      fontFiles,
      emojiOverlays: overlays,
    });

    await saveResult(output, `${OUTPUT_DIR}/captions-jp-emoji.mp4`);
  }, 180_000);

  test("Arabic text + emoji overlay (RTL baseline)", async () => {
    const originalText = "مرحبا 💪 بالعالم";
    const fontSize = 56;
    const alignment = 2;
    const marginV = 50;

    const { overlays, strippedTaggedText, fontResolution } = await buildEmojiOverlays({
      text: originalText,
      primaryFontId: "montserrat",
      fontSize,
      alignment,
      marginV,
      startTime: 0,
      endTime: 4,
    });

    console.log(`[test] Arabic emoji: ${overlays.length} overlays`);
    for (const o of overlays) {
      console.log(`  ${o.fileName}: x=${o.x}, y=${o.y}, size=${o.size}`);
    }

    const assContent = makeASS({
      fontName: fontResolution.primary.fontName,
      fontSize,
      alignment,
      marginV,
      dialogues: [
        { start: "0:00:00.00", end: "0:00:04.00", text: strippedTaggedText },
      ],
    });
    const assPath = writeASS("ar-emoji", assContent);

    const fontFiles = fontResolution.fontFiles
      .filter((f) => f.id !== "noto-emoji")
      .map((f) => ({ url: f.url, fileName: f.fileName }));

    const output = await burnCaptions({
      video: { type: "url", url: TEST_VIDEO },
      assPath,
      outputPath: `${OUTPUT_DIR}/captions-ar-emoji.mp4`,
      backend: rendiBackend,
      verbose: true,
      fontFiles,
      emojiOverlays: overlays,
    });

    await saveResult(output, `${OUTPUT_DIR}/captions-ar-emoji.mp4`);
  }, 180_000);
});

// ---------------------------------------------------------------------------
// All 9 primary fonts — Latin text through Rendi
// ---------------------------------------------------------------------------

/** All 9 primary font IDs. */
const ALL_FONT_IDS = [
  "montserrat",
  "roboto",
  "poppins",
  "inter",
  "bebas-neue",
  "rock-salt",
  "oswald",
  "space-grotesk",
  "dm-sans",
] as const;

/**
 * Helper: burn a caption line with a specific font through Rendi.
 * Uses resolveFonts() to get the correct font file, generates ASS,
 * and returns the output path.
 */
async function burnFontTest(opts: {
  fontId: string;
  text: string;
  label: string;
  fontSize?: number;
}): Promise<string> {
  const { fontId, text, label, fontSize = 56 } = opts;
  const alignment = 2;
  const marginV = 50;

  const fontResolution = resolveFonts(text, fontId);
  const taggedText = fontResolution.tagText(text);

  const assContent = makeASS({
    fontName: fontResolution.primary.fontName,
    fontSize,
    alignment,
    marginV,
    dialogues: [
      { start: "0:00:00.00", end: "0:00:02.00", text: taggedText },
      { start: "0:00:02.00", end: "0:00:04.00", text: taggedText },
    ],
  });
  const assPath = writeASS(label, assContent);

  const fontFiles = fontResolution.fontFiles.map((f) => ({
    url: f.url,
    fileName: f.fileName,
  }));

  const outPath = `${OUTPUT_DIR}/captions-${label}.mp4`;
  const output = await burnCaptions({
    video: { type: "url", url: TEST_VIDEO },
    assPath,
    outputPath: outPath,
    backend: rendiBackend,
    verbose: true,
    fontFiles,
  });

  await saveResult(output, outPath);
  return outPath;
}

describe.skipIf(!shouldRun)("all fonts via Rendi", () => {
  for (const fontId of ALL_FONT_IDS) {
    test(`font: ${fontId}`, async () => {
      await burnFontTest({
        fontId,
        text: "The quick brown fox jumps",
        label: `font-${fontId}`,
      });
    }, 120_000);
  }
});

// ---------------------------------------------------------------------------
// Multi-script font tests through Rendi
// ---------------------------------------------------------------------------

describe.skipIf(!shouldRun)("multi-script fonts via Rendi", () => {
  test("montserrat + Cyrillic (Russian)", async () => {
    await burnFontTest({
      fontId: "montserrat",
      text: "Привет мир",
      label: "script-montserrat-cyrillic",
    });
  }, 120_000);

  test("roboto + Greek", async () => {
    await burnFontTest({
      fontId: "roboto",
      text: "Γεια σου κόσμε",
      label: "script-roboto-greek",
    });
  }, 120_000);

  test("poppins + Hindi (Devanagari)", async () => {
    await burnFontTest({
      fontId: "poppins",
      text: "नमस्ते दुनिया",
      label: "script-poppins-hindi",
    });
  }, 120_000);

  test("montserrat + Japanese (CJK fallback)", async () => {
    await burnFontTest({
      fontId: "montserrat",
      text: "こんにちは世界",
      label: "script-montserrat-japanese",
    });
  }, 120_000);

  test("montserrat + Korean (Hangul fallback)", async () => {
    await burnFontTest({
      fontId: "montserrat",
      text: "안녕하세요 세계",
      label: "script-montserrat-korean",
    });
  }, 120_000);

  test("montserrat + Chinese (CJK SC fallback)", async () => {
    await burnFontTest({
      fontId: "montserrat",
      text: "你好世界",
      label: "script-montserrat-chinese",
    });
  }, 120_000);

  test("montserrat + Arabic (Noto Arabic fallback)", async () => {
    await burnFontTest({
      fontId: "montserrat",
      text: "مرحبا بالعالم",
      label: "script-montserrat-arabic",
    });
  }, 120_000);

  test("montserrat + Thai (Noto Thai fallback)", async () => {
    await burnFontTest({
      fontId: "montserrat",
      text: "สวัสดีชาวโลก",
      label: "script-montserrat-thai",
    });
  }, 120_000);

  test("bebas-neue + mixed English/Japanese", async () => {
    await burnFontTest({
      fontId: "bebas-neue",
      text: "HELLO こんにちは WORLD",
      label: "script-bebas-mixed-en-jp",
    });
  }, 120_000);

  test("rock-salt + mixed English/Korean", async () => {
    await burnFontTest({
      fontId: "rock-salt",
      text: "Hello 안녕 World",
      label: "script-rocksalt-mixed-en-kr",
    });
  }, 120_000);
});
