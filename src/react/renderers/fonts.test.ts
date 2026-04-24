import { describe, expect, test } from "bun:test";
import {
  detectScript,
  detectScriptsInText,
  FALLBACK_FONTS,
  getDefaultFontId,
  getPrimaryFont,
  PRIMARY_FONTS,
  resolveFonts,
  type Script,
} from "./fonts";

// ---------------------------------------------------------------------------
// detectScript
// ---------------------------------------------------------------------------

describe("detectScript", () => {
  test("detects Latin characters", () => {
    expect(detectScript("A".codePointAt(0)!)).toBe("latin");
    expect(detectScript("z".codePointAt(0)!)).toBe("latin");
    expect(detectScript("é".codePointAt(0)!)).toBe("latin");
    expect(detectScript("ñ".codePointAt(0)!)).toBe("latin");
  });

  test("detects Cyrillic characters", () => {
    expect(detectScript("Я".codePointAt(0)!)).toBe("cyrillic");
    expect(detectScript("щ".codePointAt(0)!)).toBe("cyrillic");
    expect(detectScript("Ї".codePointAt(0)!)).toBe("cyrillic");
  });

  test("detects Greek characters", () => {
    expect(detectScript("Ω".codePointAt(0)!)).toBe("greek");
    expect(detectScript("α".codePointAt(0)!)).toBe("greek");
  });

  test("detects Hiragana", () => {
    expect(detectScript("あ".codePointAt(0)!)).toBe("hiragana");
    expect(detectScript("ん".codePointAt(0)!)).toBe("hiragana");
  });

  test("detects Katakana", () => {
    expect(detectScript("ア".codePointAt(0)!)).toBe("katakana");
    expect(detectScript("ン".codePointAt(0)!)).toBe("katakana");
  });

  test("detects CJK ideographs", () => {
    expect(detectScript("漢".codePointAt(0)!)).toBe("cjk");
    expect(detectScript("字".codePointAt(0)!)).toBe("cjk");
  });

  test("detects Hangul", () => {
    expect(detectScript("한".codePointAt(0)!)).toBe("hangul");
    expect(detectScript("글".codePointAt(0)!)).toBe("hangul");
  });

  test("detects Arabic", () => {
    expect(detectScript("ع".codePointAt(0)!)).toBe("arabic");
    expect(detectScript("ب".codePointAt(0)!)).toBe("arabic");
  });

  test("detects Hebrew", () => {
    expect(detectScript("א".codePointAt(0)!)).toBe("hebrew");
    expect(detectScript("ש".codePointAt(0)!)).toBe("hebrew");
  });

  test("detects Devanagari", () => {
    expect(detectScript("अ".codePointAt(0)!)).toBe("devanagari");
    expect(detectScript("ह".codePointAt(0)!)).toBe("devanagari");
  });

  test("detects Thai", () => {
    expect(detectScript("ก".codePointAt(0)!)).toBe("thai");
    expect(detectScript("ม".codePointAt(0)!)).toBe("thai");
  });

  test("detects emoji", () => {
    expect(detectScript("😀".codePointAt(0)!)).toBe("emoji");
    expect(detectScript("🎉".codePointAt(0)!)).toBe("emoji");
    expect(detectScript("💪".codePointAt(0)!)).toBe("emoji");
  });

  test("detects common characters (digits, punctuation, spaces)", () => {
    expect(detectScript(" ".codePointAt(0)!)).toBe("common");
    expect(detectScript("0".codePointAt(0)!)).toBe("common");
    expect(detectScript("!".codePointAt(0)!)).toBe("common");
    expect(detectScript(",".codePointAt(0)!)).toBe("common");
  });
});

// ---------------------------------------------------------------------------
// detectScriptsInText
// ---------------------------------------------------------------------------

describe("detectScriptsInText", () => {
  test("pure English", () => {
    const scripts = detectScriptsInText("Hello world");
    expect(scripts.has("latin")).toBe(true);
    expect(scripts.size).toBe(1);
  });

  test("pure Japanese", () => {
    const scripts = detectScriptsInText("こんにちは世界");
    expect(scripts.has("hiragana")).toBe(true);
    expect(scripts.has("cjk")).toBe(true);
  });

  test("mixed English + Japanese", () => {
    const scripts = detectScriptsInText("Hello こんにちは");
    expect(scripts.has("latin")).toBe(true);
    expect(scripts.has("hiragana")).toBe(true);
  });

  test("Russian text", () => {
    const scripts = detectScriptsInText("Привет мир");
    expect(scripts.has("cyrillic")).toBe(true);
    expect(scripts.size).toBe(1);
  });

  test("Arabic text", () => {
    const scripts = detectScriptsInText("مرحبا بالعالم");
    expect(scripts.has("arabic")).toBe(true);
  });

  test("Korean text", () => {
    const scripts = detectScriptsInText("안녕하세요");
    expect(scripts.has("hangul")).toBe(true);
  });

  test("English + emoji", () => {
    const scripts = detectScriptsInText("Let's go! 💪🎉");
    expect(scripts.has("latin")).toBe(true);
    expect(scripts.has("emoji")).toBe(true);
  });

  test("mixed Japanese + English + emoji", () => {
    const scripts = detectScriptsInText("エアスクワット Let's go! 💪");
    expect(scripts.has("katakana")).toBe(true);
    expect(scripts.has("latin")).toBe(true);
    expect(scripts.has("emoji")).toBe(true);
  });

  test("empty string returns empty set", () => {
    const scripts = detectScriptsInText("");
    expect(scripts.size).toBe(0);
  });

  test("only punctuation returns empty set (common excluded)", () => {
    const scripts = detectScriptsInText("... !!! ???");
    expect(scripts.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveFonts
// ---------------------------------------------------------------------------

describe("resolveFonts", () => {
  test("pure Latin with Montserrat — no fallbacks needed", () => {
    const { fontFiles, tagText, primary } = resolveFonts(
      "Hello world, this is a test.",
      "montserrat",
    );
    expect(primary.id).toBe("montserrat");
    expect(fontFiles.length).toBe(1);
    expect(fontFiles[0]!.id).toBe("montserrat");
    // No tagging needed
    expect(tagText("Hello world")).toBe("Hello world");
  });

  test("pure Cyrillic with Montserrat — no fallbacks (Montserrat covers Cyrillic)", () => {
    const { fontFiles, tagText } = resolveFonts("Привет мир", "montserrat");
    expect(fontFiles.length).toBe(1);
    expect(tagText("Привет мир")).toBe("Привет мир");
  });

  test("Japanese text with Montserrat — Noto CJK JP fallback added", () => {
    const { fontFiles, tagText, primary } = resolveFonts(
      "こんにちは",
      "montserrat",
    );
    expect(primary.id).toBe("montserrat");
    expect(fontFiles.length).toBe(2); // Montserrat + Noto Sans CJK JP
    expect(fontFiles.some((f) => f.id === "noto-sans-cjk-jp")).toBe(true);
    // Text should be tagged with Noto font
    const tagged = tagText("こんにちは");
    expect(tagged).toContain("{\\fnNoto Sans CJK JP}");
  });

  test("mixed English + Japanese — tags at script boundaries", () => {
    const { tagText } = resolveFonts("Hello こんにちは world", "montserrat");
    const tagged = tagText("Hello こんにちは world");
    // Should start with Latin (no tag needed, it's the default)
    expect(tagged).toMatch(/^Hello /);
    // Should switch to Noto for Japanese (space before Japanese inherits left context = primary)
    expect(tagged).toContain("{\\fnNoto Sans CJK JP}こんにちは");
    // Should switch back to Montserrat for English
    // Note: space between Japanese and English inherits Japanese font (left context)
    expect(tagged).toContain("{\\fnMontserrat}world");
  });

  test("Arabic text with Montserrat — Noto Arabic fallback", () => {
    const { fontFiles, tagText } = resolveFonts("مرحبا بالعالم", "montserrat");
    expect(fontFiles.some((f) => f.id === "noto-sans-arabic")).toBe(true);
    const tagged = tagText("مرحبا بالعالم");
    expect(tagged).toContain("{\\fnNoto Sans Arabic}");
  });

  test("Korean text with Roboto — Noto CJK KR fallback", () => {
    const { fontFiles } = resolveFonts("안녕하세요", "roboto");
    expect(fontFiles.some((f) => f.id === "noto-sans-cjk-kr")).toBe(true);
  });

  test("English + emoji — Noto Emoji fallback", () => {
    const { fontFiles, tagText } = resolveFonts("Let's go! 💪", "montserrat");
    expect(fontFiles.some((f) => f.id === "noto-emoji")).toBe(true);
    const tagged = tagText("Let's go! 💪");
    expect(tagged).toContain("{\\fnNoto Emoji}💪");
  });

  test("Poppins covers Devanagari — no fallback needed for Hindi", () => {
    const { fontFiles } = resolveFonts("नमस्ते दुनिया", "poppins");
    // Poppins covers devanagari natively
    expect(fontFiles.length).toBe(1);
    expect(fontFiles[0]!.id).toBe("poppins");
  });

  test("unknown font ID falls back to Montserrat", () => {
    const { primary } = resolveFonts("Hello", "nonexistent-font");
    expect(primary.id).toBe("montserrat");
  });

  test("multiple fallbacks for complex mixed text", () => {
    const { fontFiles } = resolveFonts(
      "Hello こんにちは 안녕 مرحبا 💪",
      "montserrat",
    );
    // Need: montserrat + noto-cjk-jp (for hiragana/cjk) + noto-cjk-kr (for hangul) + noto-arabic + noto-emoji
    expect(fontFiles.length).toBe(5);
    const ids = fontFiles.map((f) => f.id);
    expect(ids).toContain("montserrat");
    expect(ids).toContain("noto-sans-cjk-jp");
    expect(ids).toContain("noto-sans-cjk-kr");
    expect(ids).toContain("noto-sans-arabic");
    expect(ids).toContain("noto-emoji");
  });
});

// ---------------------------------------------------------------------------
// Font registry helpers
// ---------------------------------------------------------------------------

describe("font registry", () => {
  test("all primary fonts have valid S3 URLs", () => {
    for (const font of Object.values(PRIMARY_FONTS)) {
      expect(font.url).toMatch(/^https:\/\/s3\.varg\.ai\/fonts\//);
      expect(font.fileName).toBeTruthy();
      expect(font.fontName).toBeTruthy();
    }
  });

  test("all fallback fonts have valid S3 URLs", () => {
    for (const font of FALLBACK_FONTS) {
      expect(font.url).toMatch(/^https:\/\/s3\.varg\.ai\/fonts\//);
      expect(font.fileName).toBeTruthy();
      expect(font.fontName).toBeTruthy();
    }
  });

  test("getPrimaryFont returns correct font", () => {
    expect(getPrimaryFont("montserrat")?.fontName).toBe("Montserrat");
    expect(getPrimaryFont("roboto")?.fontName).toBe("Roboto");
    expect(getPrimaryFont("nonexistent")).toBeUndefined();
  });

  test("getDefaultFontId returns correct defaults", () => {
    expect(getDefaultFontId("tiktok")).toBe("montserrat");
    expect(getDefaultFontId("karaoke")).toBe("roboto");
    expect(getDefaultFontId("bounce")).toBe("oswald");
    expect(getDefaultFontId("typewriter")).toBe("dm-sans");
    expect(getDefaultFontId("unknown")).toBe("montserrat");
  });

  test("every script has at least one fallback font", () => {
    const allScripts: Script[] = [
      "latin",
      "cyrillic",
      "greek",
      "cjk",
      "hiragana",
      "katakana",
      "hangul",
      "arabic",
      "hebrew",
      "devanagari",
      "thai",
      "bengali",
      "emoji",
    ];
    for (const script of allScripts) {
      const hasFallback = FALLBACK_FONTS.some((f) =>
        f.scripts.includes(script),
      );
      expect(hasFallback).toBe(true);
    }
  });
});
