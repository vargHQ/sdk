import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineCommand } from "citty";
import { render } from "../../react/render";
import type { RenderMode, VargElement } from "../../react/types";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Animate, Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
import { fal, elevenlabs, replicate } from "vargai/ai";
`;

async function loadComponent(filePath: string): Promise<VargElement> {
  const resolvedPath = resolve(filePath);
  const source = await Bun.file(resolvedPath).text();

  const hasImports =
    source.includes("from 'vargai") ||
    source.includes('from "vargai') ||
    source.includes("from '@vargai") ||
    source.includes('from "@vargai');

  if (hasImports) {
    const mod = await import(resolvedPath);
    return mod.default;
  }

  const tmpDir = ".cache/varg-render";
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const tmpFile = `${tmpDir}/${Date.now()}.tsx`;
  await Bun.write(tmpFile, AUTO_IMPORTS + source);

  try {
    const mod = await import(resolve(tmpFile));
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

    const buffer = await render(component, {
      output: outputPath,
      cache: args.cache,
      mode,
    });

    if (!args.quiet) {
      console.log(`done! ${buffer.byteLength} bytes → ${outputPath}`);
    }
  },
});
