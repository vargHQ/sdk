/** @jsxImportSource react */

import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import type {
  CaptionsProps,
  ClipProps,
  ImageProps,
  MusicProps,
  PackshotProps,
  SliderProps,
  SpeechProps,
  SplitProps,
  SwipeProps,
  TalkingHeadProps,
  TitleProps,
  VargElement,
  VargNode,
  VideoProps,
} from "../../react/types";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
import { fal, elevenlabs, replicate } from "vargai/ai";
`;

interface StoryboardClip {
  index: number;
  duration: number | "auto";
  transition?: string;
  elements: StoryboardElement[];
}

interface StoryboardElement {
  type: string;
  prompt?: string;
  src?: string;
  text?: string;
  voice?: string;
  model?: string;
  details: Record<string, unknown>;
}

interface Storyboard {
  width: number;
  height: number;
  fps: number;
  clips: StoryboardClip[];
  globalElements: StoryboardElement[];
}

async function loadComponent(filePath: string): Promise<VargElement> {
  const resolvedPath = resolve(filePath);
  const source = await Bun.file(resolvedPath).text();

  const hasVargaiImport =
    source.includes("from 'vargai") ||
    source.includes('from "vargai') ||
    source.includes("@jsxImportSource vargai");

  const hasRelativeImport =
    source.includes("from './") || source.includes('from "./');

  const pkgDir = new URL("../../..", import.meta.url).pathname;
  const tmpDir = `${pkgDir}/.cache/varg-storyboard`;

  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  if (hasRelativeImport) {
    const mod = await import(resolvedPath);
    return mod.default;
  }

  if (hasVargaiImport) {
    const tmpFile = `${tmpDir}/${Date.now()}.tsx`;
    await Bun.write(tmpFile, source);

    try {
      const mod = await import(tmpFile);
      return mod.default;
    } finally {
      (await Bun.file(tmpFile).exists()) && (await Bun.write(tmpFile, ""));
    }
  }

  const hasAnyImport = source.includes(" from ");
  if (hasAnyImport) {
    const mod = await import(resolvedPath);
    return mod.default;
  }

  const tmpFile = `${tmpDir}/${Date.now()}.tsx`;
  await Bun.write(tmpFile, AUTO_IMPORTS + source);

  try {
    const mod = await import(tmpFile);
    return mod.default;
  } finally {
    (await Bun.file(tmpFile).exists()) && (await Bun.write(tmpFile, ""));
  }
}

function getPromptText(prompt: unknown): string | undefined {
  if (typeof prompt === "string") return prompt;
  if (prompt && typeof prompt === "object" && "text" in prompt) {
    return (prompt as { text?: string }).text;
  }
  return undefined;
}

function getModelName(model: unknown): string | undefined {
  if (!model) return undefined;
  if (typeof model === "string") return model;
  if (typeof model === "object" && "modelId" in model) {
    return (model as { modelId: string }).modelId;
  }
  return undefined;
}

function extractElementInfo(element: VargElement): StoryboardElement {
  const base: StoryboardElement = {
    type: element.type,
    details: {},
  };

  switch (element.type) {
    case "image": {
      const props = element.props as ImageProps;
      base.prompt = getPromptText(props.prompt);
      base.src = props.src;
      base.model = getModelName(props.model);
      base.details = {
        aspectRatio: props.aspectRatio,
        zoom: props.zoom,
        resize: props.resize,
        removeBackground: props.removeBackground,
      };
      break;
    }

    case "video": {
      const props = element.props as VideoProps;
      base.prompt = getPromptText(props.prompt);
      base.src = props.src;
      base.model = getModelName(props.model);
      base.details = {
        aspectRatio: props.aspectRatio,
        resize: props.resize,
        cutFrom: props.cutFrom,
        cutTo: props.cutTo,
        volume: props.volume,
      };
      break;
    }

    case "speech": {
      const props = element.props as SpeechProps;
      base.text = getTextContent(element.children);
      base.voice = props.voice;
      base.model = getModelName(props.model);
      base.details = {
        volume: props.volume,
      };
      break;
    }

    case "music": {
      const props = element.props as MusicProps;
      base.prompt = props.prompt;
      base.src = props.src;
      base.model = getModelName(props.model);
      base.details = {
        volume: props.volume,
        loop: props.loop,
        ducking: props.ducking,
        cutFrom: props.cutFrom,
        cutTo: props.cutTo,
      };
      break;
    }

    case "title": {
      const props = element.props as TitleProps;
      base.text = getTextContent(element.children);
      base.details = {
        position: props.position,
        color: props.color,
        start: props.start,
        end: props.end,
      };
      break;
    }

    case "captions": {
      const props = element.props as CaptionsProps;
      base.details = {
        style: props.style,
        color: props.color,
        activeColor: props.activeColor,
        fontSize: props.fontSize,
      };
      break;
    }

    case "talking-head": {
      const props = element.props as TalkingHeadProps;
      base.text = getTextContent(element.children);
      base.voice = props.voice;
      base.model = getModelName(props.model);
      base.details = {
        character: props.character,
        src: props.src,
        position: props.position,
        size: props.size,
      };
      break;
    }

    case "packshot": {
      const props = element.props as PackshotProps;
      base.details = {
        logo: props.logo,
        logoPosition: props.logoPosition,
        cta: props.cta,
        ctaPosition: props.ctaPosition,
        ctaColor: props.ctaColor,
        blinkCta: props.blinkCta,
        duration: props.duration,
      };
      break;
    }

    case "split": {
      const props = element.props as SplitProps;
      base.details = {
        direction: props.direction,
        children: extractChildElements(element.children),
      };
      break;
    }

    case "slider": {
      const props = element.props as SliderProps;
      base.details = {
        direction: props.direction,
        children: extractChildElements(element.children),
      };
      break;
    }

    case "swipe": {
      const props = element.props as SwipeProps;
      base.details = {
        direction: props.direction,
        interval: props.interval,
        children: extractChildElements(element.children),
      };
      break;
    }
  }

  // clean up undefined values from details
  base.details = Object.fromEntries(
    Object.entries(base.details).filter(([, v]) => v !== undefined),
  );

  return base;
}

function getTextContent(children: VargNode[]): string | undefined {
  const texts: string[] = [];
  for (const child of children) {
    if (typeof child === "string") {
      texts.push(child);
    } else if (typeof child === "number") {
      texts.push(String(child));
    }
  }
  return texts.length > 0 ? texts.join("") : undefined;
}

function extractChildElements(children: VargNode[]): StoryboardElement[] {
  const elements: StoryboardElement[] = [];
  for (const child of children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    elements.push(extractElementInfo(child as VargElement));
  }
  return elements;
}

function parseStoryboard(element: VargElement): Storyboard {
  const props = element.props as {
    width?: number;
    height?: number;
    fps?: number;
  };

  const storyboard: Storyboard = {
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    clips: [],
    globalElements: [],
  };

  let clipIndex = 0;
  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      const clipProps = childElement.props as ClipProps;
      const clip: StoryboardClip = {
        index: clipIndex++,
        duration: clipProps.duration ?? "auto",
        transition: clipProps.transition?.name,
        elements: extractChildElements(childElement.children),
      };
      storyboard.clips.push(clip);
    } else {
      // global elements like music, captions at render level
      storyboard.globalElements.push(extractElementInfo(childElement));
    }
  }

  return storyboard;
}

const TYPE_COLORS: Record<string, string> = {
  image: "#4CAF50",
  video: "#2196F3",
  speech: "#9C27B0",
  music: "#FF9800",
  title: "#E91E63",
  subtitle: "#607D8B",
  captions: "#795548",
  "talking-head": "#00BCD4",
  packshot: "#673AB7",
  split: "#3F51B5",
  slider: "#009688",
  swipe: "#FF5722",
};

function escapeHtml(str: string): string {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateHtml(storyboard: Storyboard, sourceFile: string): string {
  const escapedSourceFile = escapeHtml(sourceFile);

  const renderNestedElements = (elements: StoryboardElement[]): string => {
    return elements
      .map((el) => {
        const color = TYPE_COLORS[el.type] || "#666";
        return `<span class="nested-tag" style="background: ${color}">${el.type}</span>`;
      })
      .join(" ");
  };

  const renderCardContent = (elements: StoryboardElement[]): string => {
    return elements
      .map((el) => {
        const color = TYPE_COLORS[el.type] || "#666";
        const hasNested =
          el.details.children && Array.isArray(el.details.children);
        const nestedHtml = hasNested
          ? `<div class="nested">${renderNestedElements(el.details.children as StoryboardElement[])}</div>`
          : "";

        const promptOrText = el.prompt || el.text || el.src || "";
        const displayText = promptOrText
          ? escapeHtml(
              promptOrText.length > 120
                ? `${promptOrText.slice(0, 120)}...`
                : promptOrText,
            )
          : "";

        return `
        <div class="card-element">
          <span class="type-tag" style="background: ${color}">${el.type}</span>
          ${el.model ? `<span class="model-tag">${el.model}</span>` : ""}
          ${nestedHtml}
          ${displayText ? `<p class="prompt">${displayText}</p>` : ""}
        </div>`;
      })
      .join("");
  };

  const clipsHtml = storyboard.clips
    .map((clip) => {
      const durationText =
        clip.duration === "auto" ? "auto" : `${clip.duration}s`;

      return `
      <div class="card">
        <div class="card-header">
          <span class="clip-num">${clip.index + 1}</span>
          <span class="duration">${durationText}</span>
          ${clip.transition ? `<span class="transition">→ ${clip.transition}</span>` : ""}
        </div>
        <div class="card-content">
          ${renderCardContent(clip.elements)}
        </div>
      </div>`;
    })
    .join("\n");

  const globalHtml =
    storyboard.globalElements.length > 0
      ? `
    <div class="global-bar">
      <span class="global-label">Global:</span>
      ${storyboard.globalElements
        .map((el) => {
          const color = TYPE_COLORS[el.type] || "#666";
          const label = el.prompt || el.text || el.type;
          const shortLabel =
            label.length > 40 ? `${label.slice(0, 40)}...` : label;
          return `<span class="global-tag" style="border-color: ${color}"><span class="global-type" style="background: ${color}">${el.type}</span>${escapeHtml(shortLabel)}</span>`;
        })
        .join("")}
    </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storyboard - ${escapedSourceFile}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      line-height: 1.5;
      padding: 1.5rem;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #222;
    }
    
    .header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #fff;
    }
    
    .meta {
      font-size: 0.8rem;
      color: #666;
    }
    
    .meta span { margin-left: 1rem; }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    
    .card {
      background: #141414;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #222;
    }
    
    .card-header {
      background: #1a1a1a;
      padding: 0.5rem 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid #222;
    }
    
    .clip-num {
      background: #333;
      color: #fff;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }
    
    .duration {
      font-size: 0.75rem;
      color: #4CAF50;
    }
    
    .transition {
      font-size: 0.7rem;
      color: #FF9800;
      margin-left: auto;
    }
    
    .card-content {
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    
    .card-element {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.4rem;
    }
    
    .type-tag {
      color: #fff;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      flex-shrink: 0;
    }
    
    .model-tag {
      font-size: 0.65rem;
      color: #666;
      font-family: monospace;
      background: #1a1a1a;
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
    }
    
    .nested {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    
    .nested-tag {
      font-size: 0.55rem;
      color: #fff;
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
      opacity: 0.8;
    }
    
    .prompt {
      font-size: 0.8rem;
      color: #999;
      line-height: 1.4;
      width: 100%;
      margin-top: 0.25rem;
    }
    
    .global-bar {
      margin-top: 1.5rem;
      padding: 0.75rem;
      background: #141414;
      border-radius: 6px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      border: 1px solid #222;
    }
    
    .global-label {
      font-size: 0.75rem;
      color: #666;
      font-weight: 600;
    }
    
    .global-tag {
      font-size: 0.75rem;
      color: #888;
      padding: 0.25rem 0.5rem;
      padding-left: 0;
      border-radius: 4px;
      border: 1px solid;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      overflow: hidden;
    }
    
    .global-type {
      font-size: 0.6rem;
      color: #fff;
      padding: 0.25rem 0.4rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .summary {
      margin-top: 1rem;
      display: flex;
      gap: 1.5rem;
      font-size: 0.75rem;
      color: #555;
    }
    
    .summary strong {
      color: #888;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Storyboard</h1>
    <div class="meta">
      <span>${escapedSourceFile}</span>
      <span>${storyboard.width}×${storyboard.height}</span>
      <span>${storyboard.fps}fps</span>
    </div>
  </div>
  
  <div class="grid">
    ${clipsHtml}
  </div>
  
  ${globalHtml}
  
  <div class="summary">
    <span><strong>${storyboard.clips.length}</strong> clips</span>
    <span><strong>${countElements(storyboard, "video")}</strong> videos</span>
    <span><strong>${countElements(storyboard, "image")}</strong> images</span>
    <span><strong>${countElements(storyboard, "speech")}</strong> speech</span>
    <span><strong>${countElements(storyboard, "music")}</strong> music</span>
  </div>
</body>
</html>`;
}

function countElements(storyboard: Storyboard, type: string): number {
  let count = 0;

  const countInElements = (elements: StoryboardElement[]) => {
    for (const el of elements) {
      if (el.type === type) count++;
      if (el.details.children && Array.isArray(el.details.children)) {
        countInElements(el.details.children as StoryboardElement[]);
      }
    }
  };

  for (const clip of storyboard.clips) {
    countInElements(clip.elements);
  }
  countInElements(storyboard.globalElements);

  return count;
}

export const storyboardCmd = defineCommand({
  meta: {
    name: "storyboard",
    description: "generate html storyboard from component",
  },
  args: {
    file: {
      type: "positional" as const,
      description: "component file (.tsx)",
      required: true,
    },
    output: {
      type: "string" as const,
      alias: "o",
      description: "output html path",
    },
    quiet: {
      type: "boolean" as const,
      alias: "q",
      description: "minimal output",
      default: false,
    },
    open: {
      type: "boolean" as const,
      description: "open in browser after generation",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;

    if (!file) {
      console.error("usage: varg storyboard <component.tsx> [-o output.html]");
      process.exit(1);
    }

    const component = await loadComponent(file);

    if (!component || component.type !== "render") {
      console.error("error: default export must be a <Render> element");
      process.exit(1);
    }

    const baseName = basename(file).replace(/\.tsx?$/, "");
    const outputPath =
      (args.output as string) ?? `output/${baseName}-storyboard.html`;

    // ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    if (!args.quiet) {
      console.log(`parsing ${file}...`);
    }

    const storyboard = parseStoryboard(component);
    const html = generateHtml(storyboard, file);

    await Bun.write(outputPath, html);

    if (!args.quiet) {
      console.log(`storyboard generated: ${outputPath}`);
      console.log(
        `  ${storyboard.clips.length} clips, ${storyboard.width}x${storyboard.height}`,
      );
    }

    if (args.open) {
      const { $ } = await import("bun");
      await $`open ${outputPath}`.quiet();
    }
  },
});

function StoryboardHelpView() {
  const examples = [
    {
      command: "varg storyboard video.tsx",
      description: "generate storyboard to output/video-storyboard.html",
    },
    {
      command: "varg storyboard video.tsx -o storyboard.html",
      description: "custom output path",
    },
    {
      command: "varg storyboard video.tsx --open",
      description: "generate and open in browser",
    },
  ];

  return (
    <VargBox title="varg storyboard">
      <Box marginBottom={1}>
        <Text>
          generate an html storyboard from a varg component. shows all clips,
          prompts, and settings in a visual layout.
        </Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg storyboard {"<file.tsx>"} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">-o, --output </VargText>output path
          (default: output/{"<name>"}-storyboard.html)
        </Text>
        <Text>
          <VargText variant="accent">--open </VargText>open in browser after
          generation
        </Text>
        <Text>
          <VargText variant="accent">-q, --quiet </VargText>minimal output
        </Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

export function showStoryboardHelp() {
  renderStatic(<StoryboardHelpView />);
}
