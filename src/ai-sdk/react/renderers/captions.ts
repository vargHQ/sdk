import { writeFileSync } from "node:fs";
import { convertToSRT, fireworksProvider } from "../../../providers/fireworks";
import type { CaptionsProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";
import { renderSpeech } from "./speech";

interface SrtEntry {
  index: number;
  start: number;
  end: number;
  text: string;
}

interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  backColor: string;
  bold: boolean;
  outline: number;
  shadow: number;
  marginV: number;
  alignment: number;
}

const STYLE_PRESETS: Record<string, SubtitleStyle> = {
  tiktok: {
    fontName: "Montserrat",
    fontSize: 32,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H80000000",
    bold: true,
    outline: 3,
    shadow: 0,
    marginV: 50,
    alignment: 2,
  },
  karaoke: {
    fontName: "Arial",
    fontSize: 28,
    primaryColor: "&H00FFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    bold: true,
    outline: 2,
    shadow: 1,
    marginV: 40,
    alignment: 2,
  },
  bounce: {
    fontName: "Impact",
    fontSize: 36,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    bold: false,
    outline: 4,
    shadow: 2,
    marginV: 60,
    alignment: 2,
  },
  typewriter: {
    fontName: "Courier New",
    fontSize: 24,
    primaryColor: "&H00FF00",
    outlineColor: "&H000000",
    backColor: "&H80000000",
    bold: false,
    outline: 1,
    shadow: 0,
    marginV: 30,
    alignment: 2,
  },
};

function parseSrt(content: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = Number.parseInt(lines[0] || "0", 10);
    const timeLine = lines[1] || "";
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );

    if (!timeMatch) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    if (!h1 || !m1 || !s1 || !ms1 || !h2 || !m2 || !s2 || !ms2) continue;

    const start =
      Number.parseInt(h1, 10) * 3600 +
      Number.parseInt(m1, 10) * 60 +
      Number.parseInt(s1, 10) +
      Number.parseInt(ms1, 10) / 1000;

    const end =
      Number.parseInt(h2, 10) * 3600 +
      Number.parseInt(m2, 10) * 60 +
      Number.parseInt(s2, 10) +
      Number.parseInt(ms2, 10) / 1000;

    const text = lines.slice(2).join("\n");
    entries.push({ index, start, end, text });
  }

  return entries;
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function convertSrtToAss(srtContent: string, style: SubtitleStyle): string {
  const assHeader = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.backColor},${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},10,10,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const entries = parseSrt(srtContent);
  const assDialogues = entries
    .map((entry) => {
      const start = formatAssTime(entry.start);
      const end = formatAssTime(entry.end);
      const text = entry.text.replace(/\n/g, "\\N");
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return assHeader + assDialogues;
}

function colorToAss(color: string): string {
  if (color.startsWith("&H")) return color;

  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);
    return `&H${b}${g}${r}`.toUpperCase();
  }
  return "&HFFFFFF";
}

export interface CaptionsResult {
  assPath: string;
  srtPath?: string;
}

export async function renderCaptions(
  element: VargElement<"captions">,
  ctx: RenderContext,
): Promise<CaptionsResult> {
  const props = element.props as CaptionsProps;

  let srtContent: string;
  let srtPath: string | undefined;

  if (props.srt) {
    srtContent = await Bun.file(props.srt).text();
    srtPath = props.srt;
  } else if (props.src) {
    if (typeof props.src === "string") {
      srtContent = await Bun.file(props.src).text();
      srtPath = props.src;
    } else if (props.src.type === "speech") {
      const speechResult = await renderSpeech(props.src, ctx);

      const transcribeTaskId = ctx.progress
        ? addTask(ctx.progress, "transcribe", "fireworks")
        : null;
      if (transcribeTaskId && ctx.progress)
        startTask(ctx.progress, transcribeTaskId);

      const result = await fireworksProvider.transcribe({
        audioPath: speechResult.path,
      });

      if (transcribeTaskId && ctx.progress)
        completeTask(ctx.progress, transcribeTaskId);

      srtContent = convertToSRT(result.words || []);

      srtPath = `/tmp/varg-captions-${Date.now()}.srt`;
      writeFileSync(srtPath, srtContent);
      ctx.tempFiles.push(srtPath);
    } else {
      throw new Error(
        "Captions src must be a path to SRT file or Speech element",
      );
    }
  } else {
    throw new Error("Captions element requires either 'srt' or 'src' prop");
  }

  const styleName = props.style ?? "tiktok";
  const baseStyle = STYLE_PRESETS[styleName] ?? STYLE_PRESETS.tiktok!;

  const style: SubtitleStyle = {
    ...baseStyle,
    fontSize: props.fontSize ?? baseStyle.fontSize,
    primaryColor: props.color
      ? colorToAss(props.color)
      : baseStyle.primaryColor,
  };

  const assContent = convertSrtToAss(srtContent, style);
  const assPath = `/tmp/varg-captions-${Date.now()}.ass`;
  writeFileSync(assPath, assContent);
  ctx.tempFiles.push(assPath);

  return { assPath, srtPath };
}
