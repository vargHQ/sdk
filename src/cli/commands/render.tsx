/** @jsxImportSource react */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { render } from "../../react/render";
import type { DefaultModels, RenderMode, VargElement } from "../../react/types";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
import { fal, elevenlabs, replicate } from "vargai/ai";
`;

async function detectDefaultModels(): Promise<DefaultModels | undefined> {
  const defaults: DefaultModels = {};

  const falKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (falKey) {
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

  const hasVargaiImport =
    source.includes("from 'vargai") ||
    source.includes('from "vargai') ||
    source.includes("@jsxImportSource vargai");

  const hasRelativeImport =
    source.includes("from './") || source.includes('from "./');

  const pkgDir = new URL("../../..", import.meta.url).pathname;
  const tmpDir = `${pkgDir}/.cache/varg-render`;

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

function RenderHelpView() {
  const examples = [
    {
      command: "varg render video.tsx",
      description: "render component to output/video.mp4",
    },
    {
      command: "varg render video.tsx -o my-video.mp4",
      description: "custom output path",
    },
    {
      command: "varg preview video.tsx",
      description: "fast preview with placeholders",
    },
  ];

  return (
    <VargBox title="varg render">
      <Box marginBottom={1}>
        <Text>
          render jsx components to video. the react engine for ai video.
        </Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg render {"<file.tsx>"} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">-o, --output </VargText>output path
          (default: output/{"<name>"}.mp4)
        </Text>
        <Text>
          <VargText variant="accent">-c, --cache </VargText>cache directory
          (default: .cache/ai)
        </Text>
        <Text>
          <VargText variant="accent">--no-cache </VargText>disable cache
        </Text>
        <Text>
          <VargText variant="accent">-q, --quiet </VargText>minimal output
        </Text>
        <Text>
          <VargText variant="accent">-v, --verbose </VargText>show ffmpeg
          commands
        </Text>
      </Box>

      <Header>COMPONENTS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>{"<Render>"} root container (width, height, fps)</Text>
        <Text>{"<Clip>"} time segment with duration</Text>
        <Text>{"<Video>"} ai-generated or source video</Text>
        <Text>{"<Image>"} ai-generated or static image</Text>
        <Text>{"<Speech>"} text-to-speech audio</Text>
        <Text>{"<Music>"} background music</Text>
        <Text>{"<Captions>"} auto-generated subtitles</Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

function PreviewHelpView() {
  const examples = [
    {
      command: "varg preview video.tsx",
      description: "quick test without ai calls",
    },
    {
      command: "varg preview video.tsx -o test.mp4",
      description: "preview to custom path",
    },
  ];

  return (
    <VargBox title="varg preview">
      <Box marginBottom={1}>
        <Text>
          fast preview mode - uses placeholders instead of ai generation.
        </Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg preview {"<file.tsx>"} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">-o, --output </VargText>output path
          (default: output/{"<name>"}.mp4)
        </Text>
        <Text>
          <VargText variant="accent">-q, --quiet </VargText>minimal output
        </Text>
        <Text>
          <VargText variant="accent">-v, --verbose </VargText>show ffmpeg
          commands
        </Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

export function showRenderHelp() {
  renderStatic(<RenderHelpView />);
}

export function showPreviewHelp() {
  renderStatic(<PreviewHelpView />);
}
