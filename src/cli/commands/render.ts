import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import { render } from "../../react/render";
import type { DefaultModels, RenderMode, VargElement } from "../../react/types";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
import { fal, elevenlabs, replicate } from "vargai/ai";
`;

async function detectDefaultModels(): Promise<DefaultModels | undefined> {
  const defaults: DefaultModels = {};

  if (process.env.FAL_KEY) {
    const { fal } = await import("../../ai-sdk/providers/fal");
    defaults.image = fal.imageModel("flux-schnell");
    defaults.video = fal.videoModel("wan-2.5");
  }

  if (process.env.ELEVENLABS_API_KEY) {
    const { elevenlabs } = await import("../../ai-sdk/providers/elevenlabs");
    defaults.speech = elevenlabs.speechModel("eleven_multilingual_v2");
    defaults.music = elevenlabs.musicModel("music_v1");
  }

  return Object.keys(defaults).length > 0 ? defaults : undefined;
}

async function loadComponent(filePath: string): Promise<VargElement> {
  const resolvedPath = resolve(filePath);
  const source = await Bun.file(resolvedPath).text();

  const hasAnyImport = source.includes(" from ");
  const hasVargaiImport =
    source.includes("from 'vargai") ||
    source.includes('from "vargai') ||
    source.includes("from '@vargai") ||
    source.includes('from "@vargai');

  const hasJsxPragma =
    source.includes("@jsxImportSource") || source.includes("@jsx ");

  // file has imports (relative or absolute) - import directly to preserve paths
  if (hasAnyImport) {
    const mod = await import(resolvedPath);
    return mod.default;
  }

  // no imports - inject auto-imports and jsx pragma
  const pkgDir = new URL("../../..", import.meta.url).pathname;
  const tmpDir = `${pkgDir}/.cache/varg-render`;
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
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

const sharedArgs = {
  file: {
    type: "positional" as const,
    description: "component file (.tsx)",
    required: true,
  },
  output: {
    type: "string" as const,
    alias: "o",
    description: "output path",
  },
  cache: {
    type: "string" as const,
    alias: "c",
    description: "cache directory",
    default: ".cache/ai",
  },
  quiet: {
    type: "boolean" as const,
    alias: "q",
    description: "minimal output",
    default: false,
  },
  "no-cache": {
    type: "boolean" as const,
    description: "disable cache (don't read or write)",
    default: false,
  },
  verbose: {
    type: "boolean" as const,
    alias: "v",
    description: "show ffmpeg commands",
    default: false,
  },
};

async function runRender(
  args: Record<string, unknown>,
  mode: RenderMode,
  commandName: string,
) {
  const file = args.file as string;

  if (!file) {
    console.error(`usage: varg ${commandName} <component.tsx> [-o output.mp4]`);
    process.exit(1);
  }

  const component = await loadComponent(file);

  if (!component || component.type !== "render") {
    console.error("error: default export must be a <Render> element");
    process.exit(1);
  }

  const basename = file
    .replace(/\.tsx?$/, "")
    .split("/")
    .pop();
  const outputPath = (args.output as string) ?? `output/${basename}.mp4`;

  if (!args.quiet) {
    const modeLabel = mode === "preview" ? " (fast)" : "";
    console.log(`rendering ${file} → ${outputPath}${modeLabel}`);
  }

  const useCache = !args["no-cache"] && mode !== "preview";

  const defaults = await detectDefaultModels();

  const buffer = await render(component, {
    output: outputPath,
    cache: useCache ? (args.cache as string) : undefined,
    mode,
    defaults,
    verbose: args.verbose as boolean,
  });

  if (!args.quiet) {
    console.log(`done! ${buffer.byteLength} bytes → ${outputPath}`);
  }
}

export const renderCmd = defineCommand({
  meta: {
    name: "render",
    description: "render to video (strict mode - fails on errors)",
  },
  args: sharedArgs,
  async run({ args }) {
    await runRender(args, "strict", "render");
  },
});

export const previewCmd = defineCommand({
  meta: {
    name: "preview",
    description: "render with all placeholders (no generation)",
  },
  args: sharedArgs,
  async run({ args }) {
    await runRender(args, "preview", "preview");
  },
});
