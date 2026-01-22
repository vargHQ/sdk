import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import { render } from "../../react/render";
import type { DefaultModels, RenderMode, VargElement } from "../../react/types";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Animate, Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
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

  const hasImports =
    source.includes("from 'vargai") ||
    source.includes('from "vargai') ||
    source.includes("from '@vargai") ||
    source.includes('from "@vargai');

  const hasJsxPragma =
    source.includes("@jsxImportSource") || source.includes("@jsx ");

  if (hasImports && hasJsxPragma) {
    const mod = await import(resolvedPath);
    return mod.default;
  }

  const pkgDir = new URL("../../..", import.meta.url).pathname;
  const tmpDir = `${pkgDir}/.cache/varg-render`;
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const prepended = hasImports
    ? `/** @jsxImportSource vargai */\n`
    : AUTO_IMPORTS;
  const tmpFile = `${tmpDir}/${Date.now()}.tsx`;
  await Bun.write(tmpFile, prepended + source);

  try {
    const mod = await import(tmpFile);
    return mod.default;
  } finally {
    (await Bun.file(tmpFile).exists()) && (await Bun.write(tmpFile, ""));
  }
}

export const renderCmd = defineCommand({
  meta: {
    name: "render",
    description: "render a react component to video",
  },
  args: {
    file: {
      type: "positional",
      description: "component file (.tsx)",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "output path",
    },
    cache: {
      type: "string",
      alias: "c",
      description: "cache directory",
      default: ".cache/ai",
    },
    quiet: {
      type: "boolean",
      alias: "q",
      description: "minimal output",
      default: false,
    },
    strict: {
      type: "boolean",
      description: "fail on provider errors (no fallback)",
      default: false,
    },
    preview: {
      type: "boolean",
      description: "skip all generation, use placeholders only",
      default: false,
    },
    "no-cache": {
      type: "boolean",
      description: "disable cache (don't read or write)",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;

    if (!file) {
      console.error("usage: varg render <component.tsx> [-o output.mp4]");
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
    const outputPath = args.output ?? `output/${basename}.mp4`;

    const mode: RenderMode = args.strict
      ? "strict"
      : args.preview
        ? "preview"
        : "default";

    if (!args.quiet) {
      const modeLabel =
        mode === "preview"
          ? " (preview)"
          : mode === "strict"
            ? " (strict)"
            : "";
      console.log(`rendering ${file} → ${outputPath}${modeLabel}`);
    }

    const useCache = !args["no-cache"] && mode !== "preview";

    const defaults = await detectDefaultModels();

    const buffer = await render(component, {
      output: outputPath,
      cache: useCache ? args.cache : undefined,
      mode,
      defaults,
    });

    if (!args.quiet) {
      console.log(`done! ${buffer.byteLength} bytes → ${outputPath}`);
    }
  },
});
