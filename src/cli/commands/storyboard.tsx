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

function extractNestedFromPrompt(prompt: unknown): StoryboardElement[] {
  if (!prompt || typeof prompt !== "object") return [];

  const nested: StoryboardElement[] = [];
  const p = prompt as Record<string, unknown>;

  if (p.images && Array.isArray(p.images)) {
    for (const img of p.images) {
      if (img && typeof img === "object" && "type" in img) {
        nested.push(extractElementInfo(img as VargElement));
      }
    }
  }

  if (p.video && typeof p.video === "object" && "type" in p.video) {
    nested.push(extractElementInfo(p.video as VargElement));
  }

  if (p.audio && typeof p.audio === "object" && "type" in p.audio) {
    nested.push(extractElementInfo(p.audio as VargElement));
  }

  return nested;
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
      const nestedFromPrompt = extractNestedFromPrompt(props.prompt);
      base.details = {
        aspectRatio: props.aspectRatio,
        zoom: props.zoom,
        resize: props.resize,
        removeBackground: props.removeBackground,
        children: nestedFromPrompt.length > 0 ? nestedFromPrompt : undefined,
      };
      break;
    }

    case "video": {
      const props = element.props as VideoProps;
      base.prompt = getPromptText(props.prompt);
      base.src = props.src;
      base.model = getModelName(props.model);
      const nestedFromPrompt = extractNestedFromPrompt(props.prompt);
      base.details = {
        aspectRatio: props.aspectRatio,
        resize: props.resize,
        cutFrom: props.cutFrom,
        cutTo: props.cutTo,
        volume: props.volume,
        children: nestedFromPrompt.length > 0 ? nestedFromPrompt : undefined,
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
  image: "#34d399",
  video: "#60a5fa",
  speech: "#c084fc",
  music: "#fbbf24",
  title: "#f472b6",
  subtitle: "#94a3b8",
  captions: "#a78bfa",
  "talking-head": "#22d3ee",
  packshot: "#a855f7",
  split: "#818cf8",
  slider: "#2dd4bf",
  swipe: "#fb923c",
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
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      /* dark theme (default) */
      --bg-primary: #0d0d0f;
      --bg-card: #18181c;
      --bg-card-header: #1e1e24;
      --bg-elevated: #252530;
      --border-subtle: rgba(255, 255, 255, 0.06);
      --border-soft: rgba(255, 255, 255, 0.1);
      --text-primary: #f4f4f5;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent-mint: #6ee7b7;
      --accent-peach: #fda4af;
      --accent-lavender: #c4b5fd;
      --accent-sky: #7dd3fc;
      --accent-amber: #fcd34d;
      --shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
      --shadow-glow: 0 0 0 1px rgba(255, 255, 255, 0.04);
      --radius-squishy: 16px;
      --radius-pill: 24px;
      --radius-tag: 10px;
      --toggle-icon: "☀";
    }
    
    [data-theme="light"] {
      --bg-primary: #f8f8fa;
      --bg-card: #ffffff;
      --bg-card-header: #f3f4f6;
      --bg-elevated: #e8e9ed;
      --border-subtle: rgba(0, 0, 0, 0.06);
      --border-soft: rgba(0, 0, 0, 0.1);
      --text-primary: #18181b;
      --text-secondary: #52525b;
      --text-muted: #71717a;
      --accent-mint: #059669;
      --accent-peach: #e11d48;
      --accent-lavender: #7c3aed;
      --accent-sky: #0284c7;
      --accent-amber: #d97706;
      --shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
      --shadow-glow: 0 0 0 1px rgba(0, 0, 0, 0.03);
      --toggle-icon: "☾";
    }
    
    @media (prefers-color-scheme: light) {
      :root:not([data-theme="dark"]) {
        --bg-primary: #f8f8fa;
        --bg-card: #ffffff;
        --bg-card-header: #f3f4f6;
        --bg-elevated: #e8e9ed;
        --border-subtle: rgba(0, 0, 0, 0.06);
        --border-soft: rgba(0, 0, 0, 0.1);
        --text-primary: #18181b;
        --text-secondary: #52525b;
        --text-muted: #71717a;
        --accent-mint: #059669;
        --accent-peach: #e11d48;
        --accent-lavender: #7c3aed;
        --accent-sky: #0284c7;
        --accent-amber: #d97706;
        --shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
        --shadow-glow: 0 0 0 1px rgba(0, 0, 0, 0.03);
        --toggle-icon: "☾";
      }
    }
    
    body, .card, .card-header, .card-element, .global-bar, .global-tag, .summary span, .meta span, .model-tag {
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
    }
    
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      background-image: 
        radial-gradient(ellipse 80% 60% at 50% 0%, rgba(110, 231, 183, 0.04), transparent),
        radial-gradient(ellipse 60% 50% at 80% 100%, rgba(196, 181, 253, 0.03), transparent);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
      min-height: 100vh;
    }
    
    .theme-toggle {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
    }
    
    .theme-toggle:hover {
      background: var(--bg-card-header);
      border-color: var(--border-soft);
      transform: scale(1.05);
    }
    
    .theme-toggle:active {
      transform: scale(0.95);
    }
    
    .theme-icon::before {
      content: var(--toggle-icon);
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }
    
    .meta {
      font-size: 0.8rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .meta span {
      padding: 0.35rem 0.75rem;
      background: var(--bg-elevated);
      border-radius: var(--radius-tag);
      border: 1px solid var(--border-subtle);
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }
    
    .card {
      background: var(--bg-card);
      border-radius: var(--radius-squishy);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-soft), var(--shadow-glow);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.5), 
        0 4px 16px rgba(0, 0, 0, 0.4),
        var(--shadow-glow);
    }
    
    .card-header {
      background: var(--bg-card-header);
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .clip-num {
      background: linear-gradient(135deg, var(--accent-mint), #34d399);
      color: #0d0d0f;
      font-weight: 700;
      font-size: 0.7rem;
      padding: 0.3rem 0.6rem;
      border-radius: var(--radius-tag);
      box-shadow: 0 2px 8px rgba(110, 231, 183, 0.25);
    }
    
    .duration {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--accent-mint);
    }
    
    .transition {
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--accent-amber);
      margin-left: auto;
      padding: 0.2rem 0.5rem;
      background: rgba(252, 211, 77, 0.1);
      border-radius: 8px;
    }
    
    .card-content {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    
    .card-element {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.65rem;
      background: var(--bg-elevated);
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
    }
    
    .type-tag {
      color: #fff;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.3rem 0.55rem;
      border-radius: 8px;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    
    .model-tag {
      font-size: 0.65rem;
      font-weight: 500;
      color: var(--text-muted);
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      background: var(--bg-card);
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
    }
    
    .nested {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    
    .nested-tag {
      font-size: 0.55rem;
      font-weight: 600;
      color: #fff;
      padding: 0.2rem 0.4rem;
      border-radius: 6px;
      opacity: 0.85;
    }
    
    .prompt {
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.55;
      width: 100%;
      margin-top: 0.25rem;
    }
    
    .global-bar {
      margin-top: 2rem;
      padding: 1rem 1.25rem;
      background: var(--bg-card);
      border-radius: var(--radius-squishy);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.65rem;
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-soft), var(--shadow-glow);
    }
    
    .global-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .global-tag {
      font-size: 0.75rem;
      color: var(--text-secondary);
      padding: 0.35rem 0.65rem;
      padding-left: 0;
      border-radius: var(--radius-tag);
      border: 1px solid;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      overflow: hidden;
      background: var(--bg-elevated);
    }
    
    .global-type {
      font-size: 0.6rem;
      color: #fff;
      padding: 0.35rem 0.55rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    
    .summary {
      margin-top: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .summary span {
      padding: 0.5rem 0.85rem;
      background: var(--bg-card);
      border-radius: var(--radius-tag);
      border: 1px solid var(--border-subtle);
      transition: border-color 0.2s ease;
    }
    
    .summary span:hover {
      border-color: var(--border-soft);
    }
    
    .summary strong {
      color: var(--text-primary);
      font-weight: 600;
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
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
        <span class="theme-icon"></span>
      </button>
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
  
  <script>
    (function() {
      const root = document.documentElement;
      const stored = localStorage.getItem('storyboard-theme');
      if (stored) {
        root.setAttribute('data-theme', stored);
      }
    })();
    
    function toggleTheme() {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      let next;
      if (current === 'light') {
        next = 'dark';
      } else if (current === 'dark') {
        next = 'light';
      } else {
        next = prefersDark ? 'light' : 'dark';
      }
      
      root.setAttribute('data-theme', next);
      localStorage.setItem('storyboard-theme', next);
    }
  </script>
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
