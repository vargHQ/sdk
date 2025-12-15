#!/usr/bin/env bun

/**
 * video captioning service
 * generates and overlays subtitles on videos using ffmpeg
 * supports auto-generation via groq/fireworks or custom srt files
 *
 * modes:
 * - basic: standard SRT subtitles with customizable style
 * - tiktok: word-by-word animated captions with bounce effects
 */

import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import type { ActionMeta } from "../../cli/types";
import { transcribe } from "../transcribe";
import {
  addTikTokCaptions,
  type TikTokCaptionItem,
  type TikTokWordStyle,
} from "./tiktok";

export const meta: ActionMeta = {
  name: "captions",
  type: "action",
  description: "add subtitles to video (basic or tiktok-style)",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "output"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output video path",
        },
        mode: {
          type: "string",
          enum: ["basic", "tiktok"],
          default: "basic",
          description:
            "caption mode: basic (SRT) or tiktok (word-by-word animated)",
        },
        srt: {
          type: "string",
          format: "file-path",
          description:
            "existing srt file (basic mode, auto-generates if not provided)",
        },
        provider: {
          type: "string",
          enum: ["groq", "fireworks"],
          default: "fireworks",
          description: "transcription provider for auto-generation",
        },
        // TikTok mode options
        position: {
          type: "string",
          enum: ["upper-middle", "middle", "lower-middle", "top", "bottom"],
          default: "upper-middle",
          description: "tiktok: caption position on screen",
        },
        bounce: {
          type: "number",
          default: 1.12,
          description: "tiktok: bounce scale for active word (1.0-1.5)",
        },
        noBounce: {
          type: "boolean",
          default: false,
          description: "tiktok: disable bounce animation",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { video, output, srt, provider, mode, position, bounce, noBounce } =
      options as {
        video: string;
        output: string;
        srt?: string;
        provider?: "groq" | "fireworks";
        mode?: "basic" | "tiktok";
        position?:
          | "upper-middle"
          | "middle"
          | "lower-middle"
          | "top"
          | "bottom";
        bounce?: number;
        noBounce?: boolean;
      };

    const tiktokStyle: TikTokWordStyle | undefined =
      mode === "tiktok"
        ? {
            position: position || "upper-middle",
            bounceScale: bounce || 1.12,
            useBounce: !noBounce,
          }
        : undefined;

    return addCaptions({
      videoPath: video,
      output,
      srtPath: srt,
      provider,
      mode,
      tiktokStyle,
    });
  },
};

// re-export tiktok types for convenience
export {
  addTikTokCaptions,
  type TikTokCaptionItem,
  type TikTokWordStyle,
} from "./tiktok";

// types
export interface AddCaptionsOptions {
  videoPath: string;
  output: string;
  /** Caption mode: basic (SRT) or tiktok (word-by-word animated) */
  mode?: "basic" | "tiktok";
  /** Existing srt file (auto-generates if not provided) - basic mode only */
  srtPath?: string;
  /** Transcription provider for auto-generation */
  provider?: "groq" | "fireworks";
  /** Style for basic mode */
  style?: SubtitleStyle;
  /** Captions with word timings for tiktok mode (auto-generates from transcription if not provided) */
  tiktokCaptions?: TikTokCaptionItem[];
  /** Style for tiktok mode */
  tiktokStyle?: TikTokWordStyle;
}

export interface SubtitleStyle {
  fontName?: string; // default: Arial
  fontSize?: number; // default: 24
  primaryColor?: string; // default: &HFFFFFF (white)
  outlineColor?: string; // default: &H000000 (black)
  bold?: boolean; // default: true
  alignment?: number; // 1-9, default: 2 (bottom center)
  marginV?: number; // vertical margin, default: 20
}

// default subtitle style
const DEFAULT_STYLE: Required<SubtitleStyle> = {
  fontName: "Arial",
  fontSize: 24,
  primaryColor: "&HFFFFFF", // white
  outlineColor: "&H000000", // black
  bold: true,
  alignment: 2, // bottom center
  marginV: 20,
};

// main function to add captions to video
export async function addCaptions(
  options: AddCaptionsOptions,
): Promise<string> {
  const {
    videoPath,
    srtPath,
    output,
    provider = "fireworks",
    style,
    mode = "basic",
    tiktokCaptions,
    tiktokStyle,
  } = options;

  if (!videoPath) {
    throw new Error("videoPath is required");
  }
  if (!output) {
    throw new Error("output is required");
  }
  if (!existsSync(videoPath)) {
    throw new Error(`video file not found: ${videoPath}`);
  }

  // TikTok mode: use word-by-word animated captions
  if (mode === "tiktok") {
    console.log("[captions] using TikTok mode (word-by-word animated)...");

    // If captions provided, use them directly
    if (tiktokCaptions && tiktokCaptions.length > 0) {
      return addTikTokCaptions({
        videoPath,
        output,
        captions: tiktokCaptions,
        style: tiktokStyle,
      });
    }

    // Otherwise, auto-generate from transcription
    console.log(`[captions] auto-generating word timings with ${provider}...`);

    // Fireworks provides word-level timestamps, groq doesn't
    if (provider === "groq") {
      console.warn(
        "[captions] warning: groq doesn't provide word-level timestamps, using fireworks instead",
      );
    }

    // Import fireworks directly for word-level data
    const { transcribeWithFireworks } = await import("../../lib/fireworks");

    const data = await transcribeWithFireworks({ audioPath: videoPath });

    if (!data.words || data.words.length === 0) {
      throw new Error("transcription returned no word data");
    }

    // Convert fireworks words to tiktok captions
    // Group words into phrases (max ~5-7 words per phrase)
    const phrases = groupWordsIntoPhrases(data.words, 6);

    console.log(`[captions] generated ${phrases.length} caption phrases`);

    return addTikTokCaptions({
      videoPath,
      output,
      captions: phrases,
      style: tiktokStyle,
    });
  }

  // Basic mode: use SRT subtitles
  console.log("[captions] adding captions to video...");

  // determine srt file path
  let finalSrtPath = srtPath;

  // if no srt file provided, auto-generate it
  if (!finalSrtPath) {
    console.log(
      `[captions] no srt file provided, auto-generating with ${provider}...`,
    );

    // generate srt file from video audio
    const tempSrtPath = videoPath.replace(/\.[^.]+$/, ".srt");

    const result = await transcribe({
      audioUrl: videoPath,
      provider,
      outputFormat: "srt",
      outputPath: tempSrtPath,
    });

    if (!result.success) {
      throw new Error(`failed to generate subtitles: ${result.error}`);
    }

    finalSrtPath = tempSrtPath;
    console.log(`[captions] generated subtitles at ${finalSrtPath}`);
  }

  if (!existsSync(finalSrtPath)) {
    throw new Error(`srt file not found: ${finalSrtPath}`);
  }

  // merge style with defaults
  const finalStyle = { ...DEFAULT_STYLE, ...style };

  // build subtitle filter with style
  const subtitlesFilter = `subtitles=${finalSrtPath}:force_style='FontName=${finalStyle.fontName},FontSize=${finalStyle.fontSize},PrimaryColour=${finalStyle.primaryColor},OutlineColour=${finalStyle.outlineColor},Bold=${finalStyle.bold ? -1 : 0},Alignment=${finalStyle.alignment},MarginV=${finalStyle.marginV}'`;

  console.log("[captions] overlaying subtitles on video...");

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters(subtitlesFilter)
      .outputOptions(["-c:a", "copy"]) // copy audio without re-encoding
      .output(output)
      .on("end", () => {
        console.log(`[captions] saved to ${output}`);
        resolve(output);
      })
      .on("error", (err) => {
        console.error("[captions] error:", err);
        reject(err);
      })
      .run();
  });
}

/**
 * Group words into phrases for TikTok captions
 */
function groupWordsIntoPhrases(
  words: Array<{ word: string; start: number; end: number }>,
  maxWordsPerPhrase: number,
): TikTokCaptionItem[] {
  const phrases: TikTokCaptionItem[] = [];
  let currentPhrase: Array<{ word: string; start: number; end: number }> = [];

  for (const word of words) {
    currentPhrase.push(word);

    // Start new phrase after reaching max words or at sentence boundaries
    const endsWithPunctuation = /[.!?]$/.test(word.word);

    if (currentPhrase.length >= maxWordsPerPhrase || endsWithPunctuation) {
      const first = currentPhrase[0];
      const last = currentPhrase[currentPhrase.length - 1];
      if (first && last) {
        phrases.push({
          text: currentPhrase.map((w) => w.word).join(" "),
          start: first.start,
          end: last.end,
          words: currentPhrase.map((w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
          })),
        });
      }
      currentPhrase = [];
    }
  }

  // Add remaining words
  if (currentPhrase.length > 0) {
    const first = currentPhrase[0];
    const last = currentPhrase[currentPhrase.length - 1];
    if (first && last) {
      phrases.push({
        text: currentPhrase.map((w) => w.word).join(" "),
        start: first.start,
        end: last.end,
        words: currentPhrase.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })),
      });
    }
  }

  return phrases;
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
