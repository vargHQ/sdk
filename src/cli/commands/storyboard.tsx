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
  imageDataUrl?: string;
  _element?: VargElement;
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
      } else if (typeof img === "string") {
        const isUrl = img.startsWith("http://") || img.startsWith("https://");
        const isLocalFile =
          img.startsWith("/") || img.startsWith("./") || img.includes(".");
        if (isUrl || isLocalFile) {
          nested.push({
            type: "input",
            src: img,
            details: {
              inputType: isUrl ? "url" : "file",
            },
          });
        }
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
    _element: element,
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
  input: "#9ca3af",
};

function escapeHtml(str: string): string {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateHtml(storyboard: Storyboard, sourceFile: string): string {
  const escapedSourceFile = escapeHtml(sourceFile);

  const renderTreeNode = (
    el: StoryboardElement,
    depth: number,
    isLast: boolean,
    parentPrefix: string,
  ): string => {
    const color = TYPE_COLORS[el.type] || "#666";
    const connector = depth === 0 ? "" : isLast ? "└─ " : "├─ ";
    const childPrefix =
      depth === 0 ? "" : parentPrefix + (isLast ? "   " : "│  ");

    const children =
      (el.details.children as StoryboardElement[] | undefined) || [];
    const childrenHtml = children
      .map((child, i) =>
        renderTreeNode(
          child,
          depth + 1,
          i === children.length - 1,
          childPrefix,
        ),
      )
      .join("");

    const isInputWithUrl =
      el.type === "input" &&
      el.src &&
      (el.src.startsWith("http://") || el.src.startsWith("https://"));

    if (isInputWithUrl) {
      const shortUrl =
        el.src!.length > 50 ? `${el.src!.slice(0, 50)}...` : el.src!;
      return `
      <div class="tree-node" style="--depth: ${depth}">
        <span class="tree-prefix">${parentPrefix}${connector}</span>
        <span class="type-tag" style="background: ${color}">${el.type}</span>
        <span class="input-preview-wrapper">
          <a href="${el.src}" target="_blank" class="tree-prompt input-url">${escapeHtml(shortUrl)}</a>
          <span class="input-preview-tooltip"><img src="${el.src}" alt="preview" /></span>
        </span>
      </div>${childrenHtml}`;
    }

    const promptOrText = el.prompt || el.text || el.src || "";
    const shortPrompt = promptOrText ? escapeHtml(promptOrText) : "";

    return `
      <div class="tree-node" style="--depth: ${depth}">
        <span class="tree-prefix">${parentPrefix}${connector}</span>
        <span class="type-tag" style="background: ${color}">${el.type}</span>
        ${el.model ? `<span class="model-tag">${el.model}</span>` : ""}
        ${shortPrompt ? `<span class="tree-prompt">${shortPrompt}</span>` : ""}
      </div>${childrenHtml}`;
  };

  const renderCardBack = (elements: StoryboardElement[]): string => {
    return elements
      .map((el) => {
        const treeHtml = renderTreeNode(el, 0, true, "");
        return `<div class="tree-view">${treeHtml}</div>`;
      })
      .join("");
  };

  const aspectRatio = `${storyboard.width} / ${storyboard.height}`;

  const clipsHtml = storyboard.clips
    .map((clip) => {
      const durationText =
        clip.duration === "auto" ? "auto" : `${clip.duration}s`;

      const mainEl = clip.elements[0];
      const previewImage = mainEl
        ? mainEl.type === "image"
          ? mainEl.imageDataUrl
          : getFirstNestedImage(mainEl)
        : undefined;

      return `
      <div class="card-wrapper">
        <div class="card-meta">
          <span class="clip-num">${clip.index + 1}</span>
          <span class="duration">${durationText}</span>
          ${clip.transition ? `<span class="transition">→ ${clip.transition}</span>` : ""}
        </div>
        <div class="flip-card" style="aspect-ratio: ${aspectRatio}">
          <div class="flip-card-inner">
            <div class="flip-card-front">
              ${previewImage ? `<img src="${previewImage}" alt="frame" />` : '<div class="card-placeholder"></div>'}
            </div>
            <div class="flip-card-back">
              ${renderCardBack(clip.elements)}
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("\n");

  const renderNestedTree = (
    children: StoryboardElement[],
    depth = 1,
  ): string => {
    return children
      .map((child, i) => {
        const isLast = i === children.length - 1;
        const connector = isLast ? "└─" : "├─";
        const color = TYPE_COLORS[child.type] || "#666";
        const grandChildren =
          (child.details.children as StoryboardElement[]) || [];

        const isInputWithUrl =
          child.type === "input" &&
          child.src &&
          (child.src.startsWith("http://") || child.src.startsWith("https://"));

        if (isInputWithUrl) {
          const shortUrl =
            child.src!.length > 60
              ? `${child.src!.slice(0, 60)}...`
              : child.src!;
          return `
          <div class="timeline-nested">
            <span class="nested-connector">${connector}</span>
            <span class="nested-type" style="background: ${color}">${child.type}</span>
            <span class="input-preview-wrapper">
              <a href="${child.src}" target="_blank" class="nested-prompt input-url">${escapeHtml(shortUrl)}</a>
              <span class="input-preview-tooltip"><img src="${child.src}" alt="preview" /></span>
            </span>
          </div>
          ${grandChildren.length > 0 ? renderNestedTree(grandChildren, depth + 1) : ""}`;
        }

        const childPrompt = child.prompt || child.text || child.src || "";

        return `
          <div class="timeline-nested">
            <span class="nested-connector">${connector}</span>
            <span class="nested-type" style="background: ${color}">${child.type}</span>
            ${child.model ? `<span class="nested-model">${child.model}</span>` : ""}
            ${childPrompt ? `<p class="nested-prompt">${escapeHtml(childPrompt)}</p>` : ""}
          </div>
          ${grandChildren.length > 0 ? renderNestedTree(grandChildren, depth + 1) : ""}`;
      })
      .join("");
  };

  const timelineHtml = storyboard.clips
    .map((clip) => {
      const mainEl = clip.elements[0];
      if (!mainEl) return "";

      const durationText =
        clip.duration === "auto" ? "auto" : `${clip.duration}s`;

      const previewImage =
        mainEl.type === "image"
          ? mainEl.imageDataUrl
          : getFirstNestedImage(mainEl);

      const videoPrompt = mainEl.prompt || "";
      const speechEl = clip.elements.find((e) => e.type === "speech");
      const speechText = speechEl?.text || "";
      const nestedChildren =
        (mainEl.details.children as StoryboardElement[]) || [];

      const color = TYPE_COLORS[mainEl.type] || "#666";

      return `
      <div class="timeline-row">
        <div class="timeline-image" style="aspect-ratio: ${aspectRatio}">
          ${previewImage ? `<img src="${previewImage}" alt="frame" />` : '<div class="timeline-placeholder"></div>'}
        </div>
        <div class="timeline-info">
          <div class="timeline-header">
            <span class="clip-num">${clip.index + 1}</span>
            <span class="duration">${durationText}</span>
            ${clip.transition ? `<span class="transition">→ ${clip.transition}</span>` : ""}
          </div>
          <div class="timeline-section">
            <div class="timeline-type-row">
              <span class="timeline-type" style="background: ${color}">${mainEl.type}</span>
              ${mainEl.model ? `<span class="timeline-model">${mainEl.model}</span>` : ""}
            </div>
            ${videoPrompt ? `<p class="timeline-text">${escapeHtml(videoPrompt)}</p>` : ""}
          </div>
          ${
            nestedChildren.length > 0
              ? `
          <div class="timeline-children">
            ${renderNestedTree(nestedChildren)}
          </div>`
              : ""
          }
          ${
            speechText
              ? `
          <div class="timeline-section">
            <span class="timeline-label">vo:</span>
            <p class="timeline-text">${escapeHtml(speechText)}</p>
          </div>`
              : ""
          }
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
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.5rem;
    }
    
    .card-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.25rem;
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
    
    .flip-card {
      perspective: 1000px;
      cursor: pointer;
    }
    
    .flip-card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transition: transform 0.6s ease;
      transform-style: preserve-3d;
    }
    
    .flip-card:hover .flip-card-inner {
      transform: rotateY(180deg);
    }
    
    .flip-card-front, .flip-card-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: var(--radius-squishy);
      overflow: hidden;
      box-shadow: var(--shadow-soft);
    }
    
    .flip-card-front {
      background: var(--bg-card);
    }
    
    .flip-card-front img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .card-placeholder {
      width: 100%;
      height: 100%;
      background: var(--bg-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 2rem;
    }
    
    .card-placeholder::after {
      content: "▶";
    }
    
    .flip-card-back {
      background: var(--bg-card);
      transform: rotateY(180deg);
      padding: 1rem;
      overflow-y: auto;
    }
    
    .flip-card-back .tree-view {
      font-size: 0.7rem;
    }
    
    .flip-card-back .tree-prompt {
      font-size: 0.75rem;
    }
    
    .element-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.65rem;
    }
    
    .card-element:not(:has(.preview-image)) .element-info {
      padding: 0;
    }
    
    .tree-view {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      line-height: 1.6;
    }
    
    .tree-node {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    
    .tree-prefix {
      color: var(--text-muted);
      white-space: pre;
      user-select: none;
    }
    
    .tree-prompt {
      color: var(--text-secondary);
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 0.8rem;
      margin-left: 0.25rem;
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
    
    .render-btn {
      background: linear-gradient(135deg, var(--accent-mint), #34d399);
      border: none;
      border-radius: 10px;
      padding: 0.5rem 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #0d0d0f;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 2px 8px rgba(110, 231, 183, 0.3);
    }
    
    .render-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(110, 231, 183, 0.4);
    }
    
    .render-btn:active {
      transform: scale(0.95);
    }
    
    .render-btn.copied {
      background: linear-gradient(135deg, var(--accent-lavender), #a78bfa);
      box-shadow: 0 2px 8px rgba(167, 139, 250, 0.3);
    }
    
    .render-icon {
      font-size: 0.7rem;
    }
    
    .view-toggle {
      display: flex;
      background: var(--bg-elevated);
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      overflow: hidden;
    }
    
    .view-toggle button {
      background: none;
      border: none;
      padding: 0.4rem 0.6rem;
      cursor: pointer;
      color: var(--text-muted);
      font-size: 0.9rem;
      transition: background 0.15s ease, color 0.15s ease;
    }
    
    .view-toggle button:hover {
      color: var(--text-secondary);
    }
    
    .view-toggle button.active {
      background: var(--bg-card);
      color: var(--text-primary);
    }
    
    .timeline {
      display: none;
      flex-direction: column;
      gap: 0;
    }
    
    .timeline.active {
      display: flex;
    }
    
    .grid.active {
      display: grid;
    }
    
    .grid:not(.active) {
      display: none;
    }
    
    .timeline-row {
      display: grid;
      grid-template-columns: minmax(300px, 1fr) 1fr;
      gap: 2rem;
      padding: 2rem 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .timeline-row:last-child {
      border-bottom: none;
    }
    
    .timeline-image {
      border-radius: var(--radius-squishy);
      overflow: hidden;
      background: var(--bg-card);
      max-width: 500px;
    }
    
    .timeline-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .timeline-placeholder {
      width: 100%;
      height: 100%;
      background: var(--bg-elevated);
    }
    
    .timeline-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1rem;
    }
    
    .timeline-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent-lavender);
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }
    
    .timeline-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .timeline-section {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    
    .timeline-type-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .timeline-type {
      color: #fff;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
    }
    
    .timeline-model {
      font-size: 0.7rem;
      color: var(--text-muted);
      font-family: monospace;
    }
    
    .timeline-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    
    .timeline-text {
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    
    .timeline-children {
      padding-left: 0.5rem;
      border-left: 2px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .timeline-nested {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
    }
    
    .nested-connector {
      color: var(--text-muted);
      font-family: monospace;
      font-size: 0.8rem;
    }
    
    .nested-type {
      color: #fff;
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
    }
    
    .nested-model {
      font-size: 0.65rem;
      color: var(--text-muted);
      font-family: monospace;
    }
    
    .nested-prompt {
      font-size: 0.85rem;
      color: var(--text-secondary);
      line-height: 1.4;
      width: 100%;
      margin-top: 0.25rem;
    }
    
    .input-preview-wrapper {
      position: relative;
      display: inline-block;
    }
    
    .input-url {
      color: var(--accent-sky);
      text-decoration: none;
      word-break: break-all;
    }
    
    .input-url:hover {
      text-decoration: underline;
    }
    
    .input-preview-tooltip {
      display: none;
      position: absolute;
      left: 0;
      top: 100%;
      margin-top: 8px;
      z-index: 1000;
      background: var(--bg-card);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-squishy);
      box-shadow: var(--shadow-soft);
      padding: 8px;
      max-width: 300px;
    }
    
    .input-preview-tooltip img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 8px;
      display: block;
    }
    
    .input-preview-wrapper:hover .input-preview-tooltip {
      display: block;
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
      <div class="view-toggle">
        <button class="active" onclick="setView('grid')" aria-label="Grid view">▦</button>
        <button onclick="setView('timeline')" aria-label="Timeline view">☰</button>
      </div>
      <button class="render-btn" onclick="copyRenderCommand()" aria-label="Copy render command">
        <span class="render-icon">▶</span>
        <span class="render-text">Render</span>
      </button>
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
        <span class="theme-icon"></span>
      </button>
    </div>
  </div>
  
  <div class="grid active">
    ${clipsHtml}
  </div>
  
  <div class="timeline">
    ${timelineHtml}
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
    
    function copyRenderCommand() {
      const cmd = "bunx vargai render ${sourceFile}";
      navigator.clipboard.writeText(cmd).then(() => {
        const btn = document.querySelector('.render-btn');
        const text = btn.querySelector('.render-text');
        btn.classList.add('copied');
        text.textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('copied');
          text.textContent = 'Render';
        }, 2000);
      });
    }
    
    function setView(view) {
      const grid = document.querySelector('.grid');
      const timeline = document.querySelector('.timeline');
      const buttons = document.querySelectorAll('.view-toggle button');
      
      if (view === 'grid') {
        grid.classList.add('active');
        timeline.classList.remove('active');
        buttons[0].classList.add('active');
        buttons[1].classList.remove('active');
      } else {
        grid.classList.remove('active');
        timeline.classList.add('active');
        buttons[0].classList.remove('active');
        buttons[1].classList.add('active');
      }
      
      localStorage.setItem('storyboard-view', view);
    }
    
    (function() {
      const stored = localStorage.getItem('storyboard-view');
      if (stored) setView(stored);
    })();
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

async function populateCachedImages(
  storyboard: Storyboard,
  cacheDir: string,
): Promise<number> {
  const { computeCacheKey } = await import("../../react/renderers/utils");
  const { fileCache } = await import("../../ai-sdk/file-cache");
  const cache = fileCache({ dir: cacheDir });

  let foundCount = 0;

  async function lookupImage(el: StoryboardElement): Promise<void> {
    if (el.type === "image" && el._element) {
      const cacheKeyParts = computeCacheKey(el._element);
      const cacheKey = `generateImage:${cacheKeyParts.map((d) => String(d ?? "")).join(":")}`;
      const cached = (await cache.get(cacheKey)) as
        | { images?: Array<{ uint8Array?: Uint8Array }> }
        | undefined;

      if (cached?.images?.[0]?.uint8Array) {
        const base64 = Buffer.from(cached.images[0].uint8Array).toString(
          "base64",
        );
        el.imageDataUrl = `data:image/png;base64,${base64}`;
        foundCount++;
      }
    }

    if (el.details.children && Array.isArray(el.details.children)) {
      for (const child of el.details.children as StoryboardElement[]) {
        await lookupImage(child);
      }
    }
  }

  async function processElements(elements: StoryboardElement[]): Promise<void> {
    for (const el of elements) {
      await lookupImage(el);

      if (el.details.children && Array.isArray(el.details.children)) {
        await processElements(el.details.children as StoryboardElement[]);
      }
    }
  }

  for (const clip of storyboard.clips) {
    await processElements(clip.elements);
  }
  await processElements(storyboard.globalElements);

  return foundCount;
}

function getFirstNestedImage(el: StoryboardElement): string | undefined {
  if (el.imageDataUrl) return el.imageDataUrl;

  if (el.details.children && Array.isArray(el.details.children)) {
    for (const child of el.details.children as StoryboardElement[]) {
      const found = getFirstNestedImage(child);
      if (found) return found;
    }
  }

  return undefined;
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
    cache: {
      type: "string" as const,
      alias: "c",
      description: "cache directory for image lookup",
      default: ".cache/ai",
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

    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    if (!args.quiet) {
      console.log(`parsing ${file}...`);
    }

    const storyboard = parseStoryboard(component);

    const cacheDir = resolve(args.cache as string);
    let cachedCount = 0;
    if (existsSync(cacheDir)) {
      cachedCount = await populateCachedImages(storyboard, cacheDir);
    }

    const html = generateHtml(storyboard, file);

    await Bun.write(outputPath, html);

    if (!args.quiet) {
      console.log(`storyboard generated: ${outputPath}`);
      console.log(
        `  ${storyboard.clips.length} clips, ${storyboard.width}x${storyboard.height}`,
      );
      if (cachedCount > 0) {
        console.log(`  ${cachedCount} cached images found`);
      }
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
