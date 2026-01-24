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

function generateHtml(storyboard: Storyboard, sourceFile: string): string {
  const escapedSourceFile = sourceFile
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const renderElement = (el: StoryboardElement, depth = 0): string => {
    const indent = "  ".repeat(depth);
    const typeColors: Record<string, string> = {
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

    const color = typeColors[el.type] || "#666";

    let html = `${indent}<div class="element" style="border-left: 4px solid ${color}">
${indent}  <div class="element-header">
${indent}    <span class="element-type" style="background: ${color}">${el.type}</span>`;

    if (el.model) {
      html += `
${indent}    <span class="element-model">${el.model}</span>`;
    }

    html += `
${indent}  </div>`;

    if (el.prompt) {
      html += `
${indent}  <div class="element-prompt">
${indent}    <strong>Prompt:</strong> ${el.prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
${indent}  </div>`;
    }

    if (el.text) {
      html += `
${indent}  <div class="element-text">
${indent}    <strong>Text:</strong> "${el.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}"
${indent}  </div>`;
    }

    if (el.src) {
      html += `
${indent}  <div class="element-src">
${indent}    <strong>Source:</strong> ${el.src}
${indent}  </div>`;
    }

    if (el.voice) {
      html += `
${indent}  <div class="element-voice">
${indent}    <strong>Voice:</strong> ${el.voice}
${indent}  </div>`;
    }

    const detailsToShow = Object.entries(el.details).filter(
      ([key, val]) => val !== undefined && key !== "children",
    );

    if (detailsToShow.length > 0) {
      html += `
${indent}  <div class="element-details">`;
      for (const [key, val] of detailsToShow) {
        const displayVal =
          typeof val === "object" ? JSON.stringify(val) : String(val);
        html += `
${indent}    <span class="detail"><strong>${key}:</strong> ${displayVal}</span>`;
      }
      html += `
${indent}  </div>`;
    }

    // render nested children if any
    if (el.details.children && Array.isArray(el.details.children)) {
      html += `
${indent}  <div class="nested-children">`;
      for (const child of el.details.children as StoryboardElement[]) {
        html += renderElement(child, depth + 2);
      }
      html += `
${indent}  </div>`;
    }

    html += `
${indent}</div>`;

    return html;
  };

  const clipsHtml = storyboard.clips
    .map((clip) => {
      const elementsHtml = clip.elements
        .map((el) => renderElement(el, 3))
        .join("\n");

      return `
      <div class="clip">
        <div class="clip-header">
          <span class="clip-number">Clip ${clip.index + 1}</span>
          <span class="clip-duration">${clip.duration === "auto" ? "auto" : `${clip.duration}s`}</span>
          ${clip.transition ? `<span class="clip-transition">→ ${clip.transition}</span>` : ""}
        </div>
        <div class="clip-elements">
          ${elementsHtml}
        </div>
      </div>`;
    })
    .join("\n");

  const globalHtml =
    storyboard.globalElements.length > 0
      ? `
    <div class="global-section">
      <h2>Global Elements</h2>
      <div class="global-elements">
        ${storyboard.globalElements.map((el) => renderElement(el, 2)).join("\n")}
      </div>
    </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storyboard - ${escapedSourceFile}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #0d0d0d;
      color: #e0e0e0;
      line-height: 1.6;
      padding: 2rem;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    
    h1 {
      color: #fff;
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
    }
    
    .meta {
      color: #888;
      font-size: 0.9rem;
    }
    
    .meta span {
      margin-right: 1.5rem;
    }
    
    .meta strong {
      color: #aaa;
    }
    
    .clips {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    
    .clip {
      background: #1a1a1a;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .clip-header {
      background: #252525;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .clip-number {
      font-weight: 600;
      color: #fff;
    }
    
    .clip-duration {
      background: #333;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: #4CAF50;
    }
    
    .clip-transition {
      color: #FF9800;
      font-size: 0.85rem;
    }
    
    .clip-elements {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .element {
      background: #222;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      padding-left: calc(1rem + 4px);
      margin-left: -4px;
    }
    
    .element-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    
    .element-type {
      color: #fff;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .element-model {
      color: #888;
      font-size: 0.85rem;
      font-family: monospace;
    }
    
    .element-prompt,
    .element-text,
    .element-src,
    .element-voice {
      margin-top: 0.5rem;
      color: #ccc;
      font-size: 0.9rem;
    }
    
    .element-prompt strong,
    .element-text strong,
    .element-src strong,
    .element-voice strong {
      color: #999;
    }
    
    .element-details {
      margin-top: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
    }
    
    .detail {
      font-size: 0.8rem;
      color: #888;
    }
    
    .detail strong {
      color: #666;
    }
    
    .nested-children {
      margin-top: 0.75rem;
      padding-left: 1rem;
      border-left: 2px solid #333;
    }
    
    .global-section {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #333;
    }
    
    .global-section h2 {
      color: #fff;
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
    
    .global-elements {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .summary {
      margin-top: 2rem;
      padding: 1rem;
      background: #1a1a1a;
      border-radius: 8px;
    }
    
    .summary h3 {
      color: #fff;
      font-size: 1rem;
      margin-bottom: 0.75rem;
    }
    
    .summary-stats {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }
    
    .stat {
      color: #888;
      font-size: 0.9rem;
    }
    
    .stat strong {
      color: #4CAF50;
      font-size: 1.25rem;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Storyboard</h1>
      <div class="meta">
        <span><strong>Source:</strong> ${escapedSourceFile}</span>
        <span><strong>Resolution:</strong> ${storyboard.width}x${storyboard.height}</span>
        <span><strong>FPS:</strong> ${storyboard.fps}</span>
      </div>
    </header>
    
    <div class="clips">
      ${clipsHtml}
    </div>
    
    ${globalHtml}
    
    <div class="summary">
      <h3>Summary</h3>
      <div class="summary-stats">
        <div class="stat">
          <strong>${storyboard.clips.length}</strong>
          clips
        </div>
        <div class="stat">
          <strong>${countElements(storyboard, "video")}</strong>
          videos
        </div>
        <div class="stat">
          <strong>${countElements(storyboard, "image")}</strong>
          images
        </div>
        <div class="stat">
          <strong>${countElements(storyboard, "speech")}</strong>
          speech
        </div>
        <div class="stat">
          <strong>${countElements(storyboard, "music")}</strong>
          music
        </div>
      </div>
    </div>
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
