#!/usr/bin/env bun
/**
 * Visual diagnostic test for emoji overlay positioning.
 *
 * Renders test frames with ffmpeg showing:
 * - ASS text with spaces where emoji were removed
 * - Red rectangle marker at the computed emoji overlay position
 * - The actual emoji PNG overlaid at the computed position
 *
 * Covers: Latin, Japanese, Korean, Arabic, Thai, Hindi, Chinese, Hebrew,
 *         mixed language+emoji, consecutive emoji, and edge cases.
 *
 * Usage:
 *   bun src/react/renderers/emoji-position-test.ts
 *
 * Output:
 *   output/emoji-position-test/*.png
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extractEmoji, stripEmoji, calculateEmojiSize, calculateEmojiY } from "./emoji";
import {
  getCharXPositions,
  getFontMetrics,
  getSpaceWidth,
  getEffectivePpem,
  parseASSSegments,
  measureEmojiGapPositions,
  loadFont,
  type FontPathMap,
} from "./text-measure";
import { resolveFonts, detectScriptsInText } from "./fonts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FONT_DIR = "/tmp/varg-caption-fonts";
const EMOJI_DIR = "/tmp/varg-caption-fonts/emoji";
const OUTPUT_DIR = "output/emoji-position-test";
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;

// All fonts: primary + Noto fallbacks
const FONTS_TO_DOWNLOAD: Record<string, { url: string; fontName: string }> = {
  // Primary fonts
  "Montserrat-Bold.ttf": { url: "https://s3.varg.ai/fonts/Montserrat-Bold.ttf", fontName: "Montserrat" },
  "Poppins-Bold.ttf": { url: "https://s3.varg.ai/fonts/Poppins-Bold.ttf", fontName: "Poppins" },
  "Roboto-Bold.ttf": { url: "https://s3.varg.ai/fonts/Roboto-Bold.ttf", fontName: "Roboto" },
  "BebasNeue-Regular.ttf": { url: "https://s3.varg.ai/fonts/BebasNeue-Regular.ttf", fontName: "Bebas Neue" },
  // Noto fallbacks
  "NotoSans-Bold.ttf": { url: "https://s3.varg.ai/fonts/NotoSans-Bold.ttf", fontName: "Noto Sans" },
  "NotoSansCJKjp-Bold.otf": { url: "https://s3.varg.ai/fonts/NotoSansCJKjp-Bold.otf", fontName: "Noto Sans CJK JP" },
  "NotoSansCJKkr-Bold.otf": { url: "https://s3.varg.ai/fonts/NotoSansCJKkr-Bold.otf", fontName: "Noto Sans CJK KR" },
  "NotoSansCJKsc-Bold.otf": { url: "https://s3.varg.ai/fonts/NotoSansCJKsc-Bold.otf", fontName: "Noto Sans CJK SC" },
  "NotoSansArabic-Bold.ttf": { url: "https://s3.varg.ai/fonts/NotoSansArabic-Bold.ttf", fontName: "Noto Sans Arabic" },
  "NotoSansHebrew-Bold.ttf": { url: "https://s3.varg.ai/fonts/NotoSansHebrew-Bold.ttf", fontName: "Noto Sans Hebrew" },
  "NotoSansDevanagari-Bold.ttf": { url: "https://s3.varg.ai/fonts/NotoSansDevanagari-Bold.ttf", fontName: "Noto Sans Devanagari" },
  "NotoSansThai-Bold.ttf": { url: "https://s3.varg.ai/fonts/NotoSansThai-Bold.ttf", fontName: "Noto Sans Thai" },
};

const EMOJI_TO_DOWNLOAD = [
  "1f525", "1f4aa", "1f389", "2b50", "1f680",
  "1f60d", "1f917", "1f64f", "2764", "1f44d",
  "1f30d", "1f1ef-1f1f5", "1f30f",
];

// ---------------------------------------------------------------------------
// Test case definition
// ---------------------------------------------------------------------------

interface TestCase {
  label: string;
  text: string;
  primaryFontId: string; // e.g. "montserrat" — used with resolveFonts
  fontSize: number;
  alignment: number;
  marginV: number;
}

const TEST_CASES: TestCase[] = [
  // ========== LATIN (baseline) ==========
  { label: "lat-begin",  text: "💪 Hello world",         primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "lat-end",    text: "Hello world 💪",         primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "lat-middle", text: "Hello 💪 world",         primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "lat-multi",  text: "💪 Hello 🔥 world 💪",  primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "lat-consec", text: "Let's go 💪🔥",          primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== JAPANESE ==========
  { label: "jp-begin",   text: "💪 こんにちは世界",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "jp-end",     text: "こんにちは世界 💪",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "jp-middle",  text: "こんにちは 💪 世界",      primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "jp-multi",   text: "🔥 すごい 💪 最高 🎉",   primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== KOREAN ==========
  { label: "kr-begin",   text: "💪 안녕하세요",           primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "kr-end",     text: "안녕하세요 세계 💪",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "kr-middle",  text: "안녕 💪 하세요",           primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== CHINESE ==========
  { label: "cn-begin",   text: "💪 你好世界",             primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "cn-end",     text: "你好世界 💪",             primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== ARABIC (RTL script) ==========
  { label: "ar-begin",   text: "💪 مرحبا بالعالم",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "ar-end",     text: "مرحبا بالعالم 💪",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "ar-middle",  text: "مرحبا 💪 بالعالم",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== THAI ==========
  { label: "th-begin",   text: "💪 สวัสดีชาวโลก",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "th-end",     text: "สวัสดีชาวโลก 💪",       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== HINDI (Devanagari) ==========
  { label: "hi-begin",   text: "💪 नमस्ते दुनिया",       primaryFontId: "poppins", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "hi-end",     text: "नमस्ते दुनिया 💪",       primaryFontId: "poppins", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== HEBREW ==========
  { label: "he-begin",   text: "💪 שלום עולם",           primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "he-end",     text: "שלום עולם 💪",           primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== MIXED LANGUAGE + EMOJI ==========
  // English + Japanese
  { label: "mix-en-jp",      text: "Hello 💪 世界",                primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "mix-jp-en",      text: "こんにちは 💪 World",          primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "mix-en-jp-en",   text: "Hi 💪 世界 🔥 Bye",           primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // English + Korean
  { label: "mix-en-kr",      text: "Hello 💪 세계",                primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // English + Arabic
  { label: "mix-en-ar",      text: "Hello 💪 عالم",               primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // English + Chinese + emoji
  { label: "mix-en-cn-em",   text: "Good 🔥 好的 💪 Nice",        primaryFontId: "montserrat", fontSize: 48, alignment: 2, marginV: 480 },

  // Japanese + Korean mix
  { label: "mix-jp-kr",      text: "日本語 💪 한국어",              primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== STRESS TESTS / EDGE CASES ==========
  // Triple consecutive emoji
  { label: "stress-3emoji",       text: "Go 💪🔥🚀",                primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  // Emoji sandwiched between every word
  { label: "stress-alt",          text: "A 💪 B 🔥 C 🚀 D",        primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  // Only emoji
  { label: "stress-only3",        text: "💪🔥🚀",                   primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  // Single emoji
  { label: "stress-single",       text: "💪",                       primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  // Very long mixed
  { label: "stress-long-mix",     text: "🚀 The quick 💪 brown fox 🔥 jumps", primaryFontId: "montserrat", fontSize: 48, alignment: 2, marginV: 480 },
  // CJK with consecutive emoji
  { label: "stress-jp-consec",    text: "すごい💪🔥最高",             primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },
  // Emoji between CJK chars (no spaces)
  { label: "stress-jp-nospace",   text: "日本💪語",                  primaryFontId: "montserrat", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== DIFFERENT FONTS ==========
  { label: "roboto-jp",      text: "Hello 💪 世界",                primaryFontId: "roboto",  fontSize: 72, alignment: 2, marginV: 480 },
  { label: "poppins-hi",     text: "💪 नमस्ते World",              primaryFontId: "poppins", fontSize: 72, alignment: 2, marginV: 480 },
  { label: "bebas-lat",      text: "💪 HELLO 🔥 WORLD 💪",        primaryFontId: "bebas-neue", fontSize: 72, alignment: 2, marginV: 480 },

  // ========== DIFFERENT SIZES ==========
  { label: "sz48-jp",        text: "こんにちは 💪 世界",            primaryFontId: "montserrat", fontSize: 48, alignment: 2, marginV: 480 },
  { label: "sz96-kr",        text: "안녕 💪 세계",                  primaryFontId: "montserrat", fontSize: 96, alignment: 2, marginV: 480 },
  { label: "sz24-mix",       text: "Hello 💪 世界",                primaryFontId: "montserrat", fontSize: 24, alignment: 2, marginV: 480 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadIfMissing(url: string, dest: string) {
  if (existsSync(dest)) return;
  const dir = dest.substring(0, dest.lastIndexOf("/"));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  console.log(`  Downloading ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  writeFileSync(dest, new Uint8Array(await res.arrayBuffer()));
}

function generateASS(
  text: string,
  fontName: string,
  fontSize: number,
  alignment: number,
  marginV: number,
  width: number,
  height: number,
): string {
  return `[Script Info]
Title: Emoji Position Test
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&HFFFFFF,&H000000FF,&H000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,${text}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Emoji Position Visual Test (Multi-Language) ===\n");

  // 1. Download all fonts
  console.log("Step 1: Downloading fonts...");
  for (const [file, info] of Object.entries(FONTS_TO_DOWNLOAD)) {
    await downloadIfMissing(info.url, `${FONT_DIR}/${file}`);
  }

  // 2. Download emoji PNGs
  console.log("Step 2: Downloading emoji PNGs...");
  for (const cp of EMOJI_TO_DOWNLOAD) {
    await downloadIfMissing(
      `https://s3.varg.ai/emoji/${cp}.png`,
      `${EMOJI_DIR}/${cp}.png`,
    );
  }

  // 3. Create output directory
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // 4. Create a 1-second black video as source
  console.log("Step 3: Creating base black video...");
  const baseVideo = "/tmp/varg-emoji-test-black.mp4";
  if (!existsSync(baseVideo)) {
    const proc = Bun.spawnSync([
      "ffmpeg", "-y", "-f", "lavfi",
      "-i", `color=black:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=1:r=1`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      baseVideo,
    ]);
    if (proc.exitCode !== 0) {
      console.error("Failed to create base video:", proc.stderr.toString());
      process.exit(1);
    }
  }

  // 5. Build a master font name -> path map from all downloaded fonts
  const masterFontPaths: FontPathMap = new Map();
  for (const [file, info] of Object.entries(FONTS_TO_DOWNLOAD)) {
    masterFontPaths.set(info.fontName, `${FONT_DIR}/${file}`);
  }

  // 6. Run each test case
  console.log(`\nStep 4: Running ${TEST_CASES.length} test cases...\n`);

  const results: { label: string; emoji: string; computedX: number; computedY: number; emojiSize: number }[] = [];
  let okCount = 0;
  let failCount = 0;

  for (const tc of TEST_CASES) {
    console.log(`  [${tc.label}] "${tc.text}" — ${tc.primaryFontId} @ ${tc.fontSize}`);

    // Use resolveFonts to get tagText, primary font, and all font files
    const fontResolution = resolveFonts(tc.text, tc.primaryFontId);
    const primaryFontPath = masterFontPaths.get(fontResolution.primary.fontName);
    if (!primaryFontPath || !existsSync(primaryFontPath)) {
      console.log(`    SKIP: primary font not found`);
      failCount++;
      continue;
    }

    // Build fontPathMap for this test case from fontResolution.fontFiles
    const fontPathMap: FontPathMap = new Map();
    for (const f of fontResolution.fontFiles) {
      const p = masterFontPaths.get(f.fontName);
      if (p && existsSync(p)) {
        fontPathMap.set(f.fontName, p);
      }
    }

    // Compute font metrics from primary font
    const metrics = getFontMetrics(primaryFontPath, tc.fontSize);
    const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_HEIGHT, VIDEO_HEIGHT);
    const spaceWidth = getSpaceWidth(primaryFontPath, tc.fontSize);
    const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

    // Strip emoji and extract instances
    const strippedText = stripEmoji(tc.text, spacesPerEmoji);
    const emojiInstances = extractEmoji(tc.text, spacesPerEmoji);

    if (emojiInstances.length === 0) {
      console.log(`    SKIP: no emoji found`);
      failCount++;
      continue;
    }

    // Apply {\fn} tagging for multi-script text
    const taggedText = fontResolution.tagText(strippedText);

    // Detect if the text contains RTL scripts (Arabic, Hebrew) that need
    // gap-based positioning instead of character-position-based positioning
    const scripts = detectScriptsInText(tc.text);
    const hasRTL = scripts.has("arabic") || scripts.has("hebrew");

    console.log(`    spacesPerEmoji=${spacesPerEmoji}, emojiSize=${emojiSize}px, fonts=${[...fontPathMap.keys()].join("+")}${hasRTL ? " [RTL]" : ""}`);
    console.log(`    stripped="${strippedText}" (${strippedText.length} chars)`);
    if (taggedText !== strippedText) {
      console.log(`    tagged="${taggedText}"`);
    }

    // Compute emoji overlay positions
    const overlays: { emojiCp: string; x: number; y: number; size: number }[] = [];
    const y = calculateEmojiY(
      tc.alignment, tc.marginV,
      metrics.winDescent, metrics.winAscent, metrics.capHeight,
      VIDEO_HEIGHT, VIDEO_HEIGHT,
    );

    if (hasRTL) {
      // RTL text: use gap detection from actual rendered pixels
      const gaps = measureEmojiGapPositions(
        taggedText,
        fontResolution.primary.fontName,
        tc.fontSize,
        FONT_DIR,
        VIDEO_WIDTH,
        VIDEO_HEIGHT,
        tc.alignment,
        10, 10, tc.marginV,
        emojiSize,
        emojiInstances.length,
      );
      console.log(`    gaps found: ${gaps.length} (need ${emojiInstances.length})`);

      for (let i = 0; i < emojiInstances.length; i++) {
        const inst = emojiInstances[i]!;
        const gap = gaps[i];
        const x = gap ? gap.x : 0;
        overlays.push({ emojiCp: inst.codepoints, x, y, size: emojiSize });
        console.log(`    ${inst.emoji} (${inst.codepoints}): gap=[${gap?.gapStart},${gap?.gapEnd}] x=${x} y=${y}`);
        results.push({ label: tc.label, emoji: inst.codepoints, computedX: x, computedY: y, emojiSize });
      }
    } else {
      // LTR text: use character-position-based positioning
      const segments = parseASSSegments(taggedText, fontResolution.primary.fontName);
      const charPositions = getCharXPositions(
        segments, fontPathMap, tc.fontSize, VIDEO_WIDTH, tc.alignment, 10, 10,
      );
      console.log(`    charPositions.length=${charPositions.length}`);

      for (const inst of emojiInstances) {
        const firstSpaceX = charPositions[inst.charIndex] ?? 0;
        const lastSpaceIdx = Math.min(
          inst.charIndex + spacesPerEmoji - 1,
          charPositions.length - 1,
        );
        const lastSpaceX = charPositions[lastSpaceIdx] ?? firstSpaceX;
        const blockEndX = lastSpaceX + spaceWidth;
        const blockWidth = blockEndX - firstSpaceX;
        const x = Math.round(firstSpaceX + blockWidth / 2 - emojiSize / 2);
        overlays.push({ emojiCp: inst.codepoints, x, y, size: emojiSize });
        console.log(`    ${inst.emoji} (${inst.codepoints}): idx=${inst.charIndex} x=${x} y=${y}`);
        results.push({ label: tc.label, emoji: inst.codepoints, computedX: x, computedY: y, emojiSize });
      }
    }

    // Generate ASS file
    const assContent = generateASS(
      taggedText,
      fontResolution.primary.fontName,
      tc.fontSize,
      tc.alignment,
      tc.marginV,
      VIDEO_WIDTH,
      VIDEO_HEIGHT,
    );
    const assPath = `/tmp/varg-emoji-test-${tc.label}.ass`;
    writeFileSync(assPath, assContent);

    const escapedAssPath = assPath.replace(/'/g, "'\\''");

    // Frame A: ASS text + red marker boxes
    const frameAPath = `${OUTPUT_DIR}/${tc.label}-markers.png`;
    const drawboxes = overlays
      .map((o) => `drawbox=x=${o.x}:y=${o.y}:w=${o.size}:h=${o.size}:color=red@0.5:t=2`)
      .join(",");
    const filterA = drawboxes
      ? `subtitles='${escapedAssPath}':fontsdir='${FONT_DIR}',${drawboxes}`
      : `subtitles='${escapedAssPath}':fontsdir='${FONT_DIR}'`;

    const procA = Bun.spawnSync([
      "ffmpeg", "-y", "-i", baseVideo,
      "-vf", filterA,
      "-frames:v", "1", "-update", "1",
      frameAPath,
    ]);
    if (procA.exitCode !== 0) {
      console.error(`    FAIL (markers): ${procA.stderr.toString().slice(-200)}`);
      failCount++;
      continue;
    }

    // Frame B: ASS text + actual emoji PNG overlays
    const frameBPath = `${OUTPUT_DIR}/${tc.label}-overlay.png`;
    const inputArgs: string[] = ["-i", baseVideo];
    for (const o of overlays) {
      const pngPath = `${EMOJI_DIR}/${o.emojiCp}.png`;
      if (existsSync(pngPath)) {
        inputArgs.push("-i", pngPath);
      }
    }

    const filterParts: string[] = [];
    filterParts.push(`[0:v]subtitles='${escapedAssPath}':fontsdir='${FONT_DIR}'[sub]`);
    let prevLabel = "sub";
    for (let i = 0; i < overlays.length; i++) {
      const o = overlays[i]!;
      const inputIdx = 1 + i;
      const nextLabel = i === overlays.length - 1 ? "vout" : `v${i}`;
      filterParts.push(`[${inputIdx}:v]scale=${o.size}:${o.size}:flags=lanczos,format=rgba[emoji${i}]`);
      filterParts.push(`[${prevLabel}][emoji${i}]overlay=x=${o.x}:y=${o.y}[${nextLabel}]`);
      prevLabel = nextLabel;
    }

    const procB = Bun.spawnSync([
      "ffmpeg", "-y", ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vout]",
      "-frames:v", "1", "-update", "1",
      frameBPath,
    ]);
    if (procB.exitCode !== 0) {
      console.error(`    FAIL (overlay): ${procB.stderr.toString().slice(-300)}`);
      failCount++;
      continue;
    }

    console.log(`    OK`);
    okCount++;
  }

  // Print summary
  console.log(`\n=== Summary: ${okCount} OK, ${failCount} FAIL ===\n`);
  console.log("Label                     | Emoji  | X    | Y    | Size");
  console.log("--------------------------|--------|------|------|-----");
  for (const r of results) {
    console.log(
      `${r.label.padEnd(26)}| ${r.emoji.padEnd(7)}| ${String(r.computedX).padEnd(5)}| ${String(r.computedY).padEnd(5)}| ${r.emojiSize}`,
    );
  }

  console.log(`\nOutput: ${OUTPUT_DIR}/`);
  console.log("  *-markers.png = ASS text + red box at computed emoji position");
  console.log("  *-overlay.png = ASS text + actual emoji PNG overlay");
}

main().catch(console.error);
