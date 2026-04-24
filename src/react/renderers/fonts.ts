/**
 * Universal font support for ASS subtitle rendering.
 *
 * Two-layer system:
 * - Primary fonts: aesthetic/style fonts (Montserrat, Roboto, etc.) for Latin/Cyrillic
 * - Fallback fonts: Noto family, auto-selected per-script for characters the primary can't render
 *
 * The SDK detects which Unicode scripts are present in caption text, selects the
 * minimum set of fonts needed, and injects {\fn} ASS override tags at script
 * boundaries so mixed-language text renders correctly in a single subtitle line.
 */

// ---------------------------------------------------------------------------
// Script detection
// ---------------------------------------------------------------------------

export type Script =
  | "latin"
  | "cyrillic"
  | "greek"
  | "cjk"
  | "hiragana"
  | "katakana"
  | "hangul"
  | "arabic"
  | "hebrew"
  | "devanagari"
  | "thai"
  | "bengali"
  | "tamil"
  | "emoji"
  | "common";

/**
 * Detect the Unicode script for a single code point.
 * Covers the major writing systems used by ~95% of the world population.
 */
export function detectScript(cp: number): Script {
  // Common: ASCII control, basic punctuation, digits, symbols
  if (cp <= 0x002f) return "common";
  if (cp >= 0x0030 && cp <= 0x0039) return "common"; // digits
  if (cp >= 0x003a && cp <= 0x0040) return "common"; // punctuation
  if (cp >= 0x005b && cp <= 0x0060) return "common";
  if (cp >= 0x007b && cp <= 0x007f) return "common";

  // Basic Latin
  if (cp >= 0x0041 && cp <= 0x005a) return "latin";
  if (cp >= 0x0061 && cp <= 0x007a) return "latin";

  // Latin Extended (accented chars, etc.)
  if (cp >= 0x0080 && cp <= 0x024f) return "latin";
  if (cp >= 0x1e00 && cp <= 0x1eff) return "latin"; // Latin Extended Additional
  if (cp >= 0x2c60 && cp <= 0x2c7f) return "latin"; // Latin Extended-C

  // General punctuation & symbols
  if (cp >= 0x2000 && cp <= 0x206f) return "common"; // General Punctuation
  if (cp >= 0x2070 && cp <= 0x209f) return "common"; // Superscripts/Subscripts
  if (cp >= 0x20a0 && cp <= 0x20cf) return "common"; // Currency Symbols
  if (cp >= 0x2100 && cp <= 0x214f) return "common"; // Letterlike Symbols
  if (cp >= 0x2150 && cp <= 0x218f) return "common"; // Number Forms
  if (cp >= 0x2190 && cp <= 0x21ff) return "common"; // Arrows
  if (cp >= 0x2200 && cp <= 0x22ff) return "common"; // Math Operators

  // Greek
  if (cp >= 0x0370 && cp <= 0x03ff) return "greek";
  if (cp >= 0x1f00 && cp <= 0x1fff) return "greek"; // Greek Extended

  // Cyrillic
  if (cp >= 0x0400 && cp <= 0x04ff) return "cyrillic";
  if (cp >= 0x0500 && cp <= 0x052f) return "cyrillic"; // Cyrillic Supplement

  // Armenian
  if (cp >= 0x0530 && cp <= 0x058f) return "latin"; // treat as latin fallback

  // Hebrew
  if (cp >= 0x0590 && cp <= 0x05ff) return "hebrew";
  if (cp >= 0xfb1d && cp <= 0xfb4f) return "hebrew"; // Hebrew Presentation Forms

  // Arabic
  if (cp >= 0x0600 && cp <= 0x06ff) return "arabic";
  if (cp >= 0x0750 && cp <= 0x077f) return "arabic"; // Arabic Supplement
  if (cp >= 0x08a0 && cp <= 0x08ff) return "arabic"; // Arabic Extended-A
  if (cp >= 0xfb50 && cp <= 0xfdff) return "arabic"; // Arabic Presentation Forms-A
  if (cp >= 0xfe70 && cp <= 0xfeff) return "arabic"; // Arabic Presentation Forms-B

  // Devanagari
  if (cp >= 0x0900 && cp <= 0x097f) return "devanagari";
  if (cp >= 0xa8e0 && cp <= 0xa8ff) return "devanagari"; // Devanagari Extended

  // Bengali
  if (cp >= 0x0980 && cp <= 0x09ff) return "bengali";

  // Tamil
  if (cp >= 0x0b80 && cp <= 0x0bff) return "tamil";

  // Thai
  if (cp >= 0x0e00 && cp <= 0x0e7f) return "thai";

  // CJK Radicals & Kangxi
  if (cp >= 0x2e80 && cp <= 0x2eff) return "cjk";
  if (cp >= 0x2f00 && cp <= 0x2fdf) return "cjk";

  // CJK Symbols and Punctuation
  if (cp >= 0x3000 && cp <= 0x303f) return "common"; // CJK punctuation (used by all CJK)

  // Hiragana
  if (cp >= 0x3040 && cp <= 0x309f) return "hiragana";

  // Katakana
  if (cp >= 0x30a0 && cp <= 0x30ff) return "katakana";
  if (cp >= 0x31f0 && cp <= 0x31ff) return "katakana"; // Katakana Phonetic Extensions
  if (cp >= 0xff65 && cp <= 0xff9f) return "katakana"; // Halfwidth Katakana

  // Bopomofo
  if (cp >= 0x3100 && cp <= 0x312f) return "cjk";

  // Hangul Compatibility Jamo
  if (cp >= 0x3130 && cp <= 0x318f) return "hangul";

  // CJK Unified Ideographs
  if (cp >= 0x3400 && cp <= 0x4dbf) return "cjk"; // Extension A
  if (cp >= 0x4e00 && cp <= 0x9fff) return "cjk"; // Main block
  if (cp >= 0xf900 && cp <= 0xfaff) return "cjk"; // Compatibility
  if (cp >= 0x20000 && cp <= 0x2a6df) return "cjk"; // Extension B
  if (cp >= 0x2a700 && cp <= 0x2b73f) return "cjk"; // Extension C
  if (cp >= 0x2b740 && cp <= 0x2b81f) return "cjk"; // Extension D

  // Hangul Syllables
  if (cp >= 0xac00 && cp <= 0xd7af) return "hangul";
  if (cp >= 0x1100 && cp <= 0x11ff) return "hangul"; // Hangul Jamo

  // Halfwidth/Fullwidth Forms
  if (cp >= 0xff01 && cp <= 0xff60) return "common"; // Fullwidth ASCII variants

  // Emoji ranges
  if (cp >= 0x1f000 && cp <= 0x1f02f) return "emoji"; // Mahjong/Dominos
  if (cp >= 0x1f0a0 && cp <= 0x1f0ff) return "emoji"; // Playing Cards
  if (cp >= 0x1f100 && cp <= 0x1f1ff) return "emoji"; // Enclosed Alphanumeric Supplement
  if (cp >= 0x1f200 && cp <= 0x1f2ff) return "emoji"; // Enclosed Ideographic Supplement
  if (cp >= 0x1f300 && cp <= 0x1f5ff) return "emoji"; // Misc Symbols and Pictographs
  if (cp >= 0x1f600 && cp <= 0x1f64f) return "emoji"; // Emoticons
  if (cp >= 0x1f680 && cp <= 0x1f6ff) return "emoji"; // Transport and Map
  if (cp >= 0x1f700 && cp <= 0x1f77f) return "emoji"; // Alchemical Symbols
  if (cp >= 0x1f780 && cp <= 0x1f7ff) return "emoji"; // Geometric Shapes Extended
  if (cp >= 0x1f800 && cp <= 0x1f8ff) return "emoji"; // Supplemental Arrows-C
  if (cp >= 0x1f900 && cp <= 0x1f9ff) return "emoji"; // Supplemental Symbols and Pictographs
  if (cp >= 0x1fa00 && cp <= 0x1fa6f) return "emoji"; // Chess Symbols
  if (cp >= 0x1fa70 && cp <= 0x1faff) return "emoji"; // Symbols and Pictographs Extended-A
  if (cp >= 0x2600 && cp <= 0x26ff) return "emoji"; // Misc Symbols
  if (cp >= 0x2700 && cp <= 0x27bf) return "emoji"; // Dingbats
  if (cp >= 0x2b50 && cp <= 0x2b55) return "emoji"; // Stars, circles (commonly used as emoji)
  if (cp >= 0xfe00 && cp <= 0xfe0f) return "common"; // Variation Selectors (emoji modifiers)
  if (cp >= 0x200d && cp <= 0x200d) return "common"; // ZWJ

  return "common";
}

/**
 * Detect all scripts present in a text string.
 */
export function detectScriptsInText(text: string): Set<Script> {
  const scripts = new Set<Script>();
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    const script = detectScript(cp);
    if (script !== "common") {
      scripts.add(script);
    }
  }
  return scripts;
}

// ---------------------------------------------------------------------------
// Font registry
// ---------------------------------------------------------------------------

const S3_BASE = "https://s3.varg.ai/fonts";

export interface FontEntry {
  /** Short ID used in CaptionsProps.font (e.g. "montserrat") */
  id: string;
  /** Internal font family name as stored in the TTF/OTF name table (used in ASS {\fn} tags) */
  fontName: string;
  /** Filename on S3 */
  fileName: string;
  /** Full S3 URL */
  url: string;
  /** Which Unicode scripts this font covers */
  scripts: Script[];
}

/** Primary (style) fonts — the aesthetic fonts users pick for their captions. */
export const PRIMARY_FONTS: Record<string, FontEntry> = {
  montserrat: {
    id: "montserrat",
    fontName: "Montserrat",
    fileName: "Montserrat-Bold.ttf",
    url: `${S3_BASE}/Montserrat-Bold.ttf`,
    scripts: ["latin", "cyrillic"],
  },
  roboto: {
    id: "roboto",
    fontName: "Roboto",
    fileName: "Roboto-Bold.ttf",
    url: `${S3_BASE}/Roboto-Bold.ttf`,
    scripts: ["latin", "cyrillic", "greek"],
  },
  poppins: {
    id: "poppins",
    fontName: "Poppins",
    fileName: "Poppins-Bold.ttf",
    url: `${S3_BASE}/Poppins-Bold.ttf`,
    scripts: ["latin", "devanagari"],
  },
  inter: {
    id: "inter",
    fontName: "Inter",
    fileName: "Inter-Bold.ttf",
    url: `${S3_BASE}/Inter-Bold.ttf`,
    scripts: ["latin", "cyrillic", "greek"],
  },
  "bebas-neue": {
    id: "bebas-neue",
    fontName: "Bebas Neue",
    fileName: "BebasNeue-Regular.ttf",
    url: `${S3_BASE}/BebasNeue-Regular.ttf`,
    scripts: ["latin"],
  },
  "rock-salt": {
    id: "rock-salt",
    fontName: "Rock Salt",
    fileName: "RockSalt-Regular.ttf",
    url: `${S3_BASE}/RockSalt-Regular.ttf`,
    scripts: ["latin"],
  },
  oswald: {
    id: "oswald",
    fontName: "Oswald",
    fileName: "Oswald-Bold.ttf",
    url: `${S3_BASE}/Oswald-Bold.ttf`,
    scripts: ["latin", "cyrillic"],
  },
  "space-grotesk": {
    id: "space-grotesk",
    fontName: "Space Grotesk",
    fileName: "SpaceGrotesk-Bold.ttf",
    url: `${S3_BASE}/SpaceGrotesk-Bold.ttf`,
    scripts: ["latin"],
  },
  "dm-sans": {
    id: "dm-sans",
    fontName: "DM Sans",
    fileName: "DMSans-Bold.ttf",
    url: `${S3_BASE}/DMSans-Bold.ttf`,
    scripts: ["latin"],
  },
};

/** Fallback fonts — Noto family, used only for scripts the primary font can't cover. */
export const FALLBACK_FONTS: FontEntry[] = [
  {
    id: "noto-sans",
    fontName: "Noto Sans",
    fileName: "NotoSans-Bold.ttf",
    url: `${S3_BASE}/NotoSans-Bold.ttf`,
    scripts: ["latin", "cyrillic", "greek", "bengali", "tamil"],
  },
  {
    id: "noto-sans-cjk-jp",
    fontName: "Noto Sans CJK JP",
    fileName: "NotoSansCJKjp-Bold.otf",
    url: `${S3_BASE}/NotoSansCJKjp-Bold.otf`,
    scripts: ["cjk", "hiragana", "katakana"],
  },
  {
    id: "noto-sans-cjk-kr",
    fontName: "Noto Sans CJK KR",
    fileName: "NotoSansCJKkr-Bold.otf",
    url: `${S3_BASE}/NotoSansCJKkr-Bold.otf`,
    scripts: ["hangul"],
  },
  {
    id: "noto-sans-cjk-sc",
    fontName: "Noto Sans CJK SC",
    fileName: "NotoSansCJKsc-Bold.otf",
    url: `${S3_BASE}/NotoSansCJKsc-Bold.otf`,
    scripts: ["cjk"], // for standalone Chinese text when no Japanese context
  },
  {
    id: "noto-sans-arabic",
    fontName: "Noto Sans Arabic",
    fileName: "NotoSansArabic-Bold.ttf",
    url: `${S3_BASE}/NotoSansArabic-Bold.ttf`,
    scripts: ["arabic"],
  },
  {
    id: "noto-sans-hebrew",
    fontName: "Noto Sans Hebrew",
    fileName: "NotoSansHebrew-Bold.ttf",
    url: `${S3_BASE}/NotoSansHebrew-Bold.ttf`,
    scripts: ["hebrew"],
  },
  {
    id: "noto-sans-devanagari",
    fontName: "Noto Sans Devanagari",
    fileName: "NotoSansDevanagari-Bold.ttf",
    url: `${S3_BASE}/NotoSansDevanagari-Bold.ttf`,
    scripts: ["devanagari"],
  },
  {
    id: "noto-sans-thai",
    fontName: "Noto Sans Thai",
    fileName: "NotoSansThai-Bold.ttf",
    url: `${S3_BASE}/NotoSansThai-Bold.ttf`,
    scripts: ["thai"],
  },
  {
    id: "noto-emoji",
    fontName: "Noto Emoji",
    fileName: "NotoEmoji-Bold.ttf",
    url: `${S3_BASE}/NotoEmoji-Bold.ttf`,
    scripts: ["emoji"],
  },
];

/** Default font IDs for each style preset. */
const STYLE_FONT_DEFAULTS: Record<string, string> = {
  tiktok: "montserrat",
  karaoke: "roboto",
  bounce: "oswald",
  typewriter: "dm-sans",
};

/**
 * Get the default primary font ID for a caption style preset.
 */
export function getDefaultFontId(style: string): string {
  return STYLE_FONT_DEFAULTS[style] ?? "montserrat";
}

/**
 * Look up a primary font by its short ID.
 * Returns undefined for unknown IDs.
 */
export function getPrimaryFont(id: string): FontEntry | undefined {
  return PRIMARY_FONTS[id];
}

// ---------------------------------------------------------------------------
// Font resolution
// ---------------------------------------------------------------------------

export interface FontResolution {
  /** The primary font entry. */
  primary: FontEntry;
  /** All font files needed (primary + any fallbacks for uncovered scripts). */
  fontFiles: FontEntry[];
  /** Tag a text string with {\fn} ASS override tags at script boundaries. */
  tagText: (text: string) => string;
}

/**
 * Resolve which fonts are needed for a given text and primary font.
 *
 * Scans the text for all Unicode scripts present, determines which the primary
 * font covers vs which need a Noto fallback, and returns:
 * - The full list of font files to include
 * - A `tagText()` function that wraps text segments with `{\fnFontName}` tags
 *
 * @param allText - All caption text concatenated (used to detect scripts)
 * @param primaryFontId - Short ID of the primary font (e.g. "montserrat")
 */
export function resolveFonts(
  allText: string,
  primaryFontId: string,
): FontResolution {
  const primary = PRIMARY_FONTS[primaryFontId] ?? PRIMARY_FONTS.montserrat!;
  const scripts = detectScriptsInText(allText);

  // Determine which scripts the primary font does NOT cover
  const primaryScriptSet = new Set(primary.scripts);
  const uncoveredScripts = new Set<Script>();
  for (const s of scripts) {
    if (!primaryScriptSet.has(s)) {
      uncoveredScripts.add(s);
    }
  }

  // Select minimum fallback fonts for uncovered scripts
  const fallbackMap = new Map<Script, FontEntry>(); // script -> font
  const selectedFallbacks: FontEntry[] = [];

  for (const script of uncoveredScripts) {
    if (fallbackMap.has(script)) continue;

    // Find the first fallback font that covers this script
    const fallback = FALLBACK_FONTS.find((f) => f.scripts.includes(script));
    if (fallback) {
      // Only add the fallback once, even if it covers multiple needed scripts
      if (!selectedFallbacks.includes(fallback)) {
        selectedFallbacks.push(fallback);
      }
      fallbackMap.set(script, fallback);
      // Also mark other scripts this fallback covers
      for (const s of fallback.scripts) {
        if (uncoveredScripts.has(s) && !fallbackMap.has(s)) {
          fallbackMap.set(s, fallback);
        }
      }
    }
  }

  const fontFiles = [primary, ...selectedFallbacks];

  /**
   * Map a script to its font name. Primary font is used for covered scripts
   * and "common" characters; fallbacks are used for uncovered scripts.
   */
  function fontForScript(script: Script): string {
    if (script === "common" || primaryScriptSet.has(script)) {
      return primary.fontName;
    }
    return fallbackMap.get(script)?.fontName ?? primary.fontName;
  }

  /**
   * Tag text with {\fn} ASS override tags at script boundaries.
   *
   * Groups consecutive characters that use the same font, inserting
   * {\fnFontName} only at transitions. If the entire text uses the
   * primary font, no tags are inserted (clean output).
   *
   * "Common" characters (punctuation, digits, spaces) inherit the font
   * of the preceding non-common script to avoid ugly fragmentation in
   * CJK text where fullwidth punctuation would otherwise trigger a font switch.
   */
  function tagText(text: string): string {
    if (uncoveredScripts.size === 0) {
      // All scripts covered by primary — no tagging needed
      return text;
    }

    // First pass: assign a font to each character.
    // Common chars inherit the last non-common font (look-ahead/look-behind).
    const chars: string[] = [];
    const scripts: Script[] = [];
    for (const char of text) {
      const cp = char.codePointAt(0);
      if (cp === undefined) continue;
      chars.push(char);
      scripts.push(detectScript(cp));
    }

    // Resolve common characters: they inherit the font of the nearest
    // non-common character (prefer left context, fall back to right, then primary)
    const resolvedFonts: string[] = new Array(chars.length);
    let lastNonCommonFont = primary.fontName;

    for (let i = 0; i < chars.length; i++) {
      if (scripts[i] === "common") {
        resolvedFonts[i] = lastNonCommonFont;
      } else {
        const font = fontForScript(scripts[i]!);
        resolvedFonts[i] = font;
        lastNonCommonFont = font;
      }
    }

    // Build segments of consecutive characters with the same font
    const segments: { font: string; chars: string }[] = [];
    let currentFont = resolvedFonts[0] ?? primary.fontName;
    let currentChars = "";

    for (let i = 0; i < chars.length; i++) {
      const font = resolvedFonts[i]!;
      if (font !== currentFont && currentChars.length > 0) {
        segments.push({ font: currentFont, chars: currentChars });
        currentFont = font;
        currentChars = chars[i]!;
      } else {
        currentChars += chars[i]!;
      }
    }
    if (currentChars.length > 0) {
      segments.push({ font: currentFont, chars: currentChars });
    }

    // Build the tagged string
    // Skip the {\fn} tag for the first segment if it uses the primary font
    // (the ASS style already sets it as default)
    let result = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      if (i === 0 && seg.font === primary.fontName) {
        result += seg.chars;
      } else if (seg.font === primary.fontName) {
        // Reset to primary
        result += `{\\fn${primary.fontName}}${seg.chars}`;
      } else {
        result += `{\\fn${seg.font}}${seg.chars}`;
      }
    }

    return result;
  }

  return { primary, fontFiles, tagText };
}
