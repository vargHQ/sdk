/** @jsxImportSource react */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import type { ExportMode, TimelineFormat } from "../../react/timeline";
import { exportTimeline } from "../../react/timeline";
import type { VargElement } from "../../react/types";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
import { fal, elevenlabs, replicate } from "vargai/ai";
`;

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
  const tmpDir = `${pkgDir}/.cache/varg-export`;

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

export const exportCmd = defineCommand({
  meta: {
    name: "export",
    description: "export jsx to timeline format (otio, fcpxml)",
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
      description: "output path",
    },
    format: {
      type: "string" as const,
      alias: "f",
      description: "output format: otio, fcpxml (default: otio)",
      default: "otio",
    },
    mode: {
      type: "string" as const,
      alias: "m",
      description:
        "export mode: placeholders, rendered (default: placeholders)",
      default: "placeholders",
    },
    cache: {
      type: "string" as const,
      alias: "c",
      description: "cache directory for assets",
      default: ".cache/timeline",
    },
    quiet: {
      type: "boolean" as const,
      alias: "q",
      description: "minimal output",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;

    if (!file) {
      console.error(
        "usage: varg export <component.tsx> [-o output.otio] [-f otio|fcpxml] [-m placeholders|rendered]",
      );
      process.exit(1);
    }

    const component = await loadComponent(file);

    if (!component || component.type !== "render") {
      console.error("error: default export must be a <Render> element");
      process.exit(1);
    }

    const format = args.format as string as TimelineFormat;
    const mode = args.mode as string as ExportMode;
    const ext = format === "otio" ? "otio" : "fcpxml";
    const basename = file
      .replace(/\.tsx?$/, "")
      .split("/")
      .pop();
    const outputPath = (args.output as string) ?? `output/${basename}.${ext}`;

    if (!args.quiet) {
      console.log(
        `exporting ${file} → ${outputPath} (${format}, ${mode} mode)`,
      );
    }

    const result = await exportTimeline(component as VargElement<"render">, {
      format,
      mode,
      output: outputPath,
      cache: args.cache as string,
      quiet: args.quiet as boolean,
    });

    if (!args.quiet) {
      console.log(
        `\ndone! exported ${result.summary.clips} clips, ${result.summary.duration.toFixed(1)}s total`,
      );
      if (result.summary.placeholders > 0) {
        console.log(
          `  ${result.summary.placeholders} placeholder assets in ${args.cache}`,
        );
      }
      console.log(`  timeline: ${result.timelinePath}`);
    }
  },
});

function ExportHelpView() {
  const examples = [
    {
      command: "varg export video.tsx",
      description: "export to output/video.otio with placeholders",
    },
    {
      command: "varg export video.tsx -f fcpxml",
      description: "export to FCP XML format",
    },
    {
      command: "varg export video.tsx -m rendered",
      description: "generate AI assets first, then export",
    },
    {
      command: "varg export video.tsx -o timeline.otio",
      description: "custom output path",
    },
  ];

  return (
    <VargBox title="varg export">
      <Box marginBottom={1}>
        <Text>
          export jsx compositions to NLE timeline formats (premiere, davinci,
          fcpx).
        </Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg export {"<file.tsx>"} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">-o, --output </VargText>output path
          (default: output/{"<name>"}.otio)
        </Text>
        <Text>
          <VargText variant="accent">-f, --format </VargText>otio | fcpxml
          (default: otio)
        </Text>
        <Text>
          <VargText variant="accent">-m, --mode </VargText>placeholders |
          rendered (default: placeholders)
        </Text>
        <Text>
          <VargText variant="accent">-c, --cache </VargText>cache directory
          (default: .cache/timeline)
        </Text>
        <Text>
          <VargText variant="accent">-q, --quiet </VargText>minimal output
        </Text>
      </Box>

      <Header>FORMATS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">otio </VargText>OpenTimelineIO - works with
          DaVinci, Premiere (plugin), Nuke
        </Text>
        <Text>
          <VargText variant="accent">fcpxml </VargText>Final Cut Pro XML - works
          with Premiere, DaVinci, FCPX
        </Text>
      </Box>

      <Header>MODES</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">placeholders </VargText>colored bars with
          prompt text (instant, for planning)
        </Text>
        <Text>
          <VargText variant="accent">rendered </VargText>generate AI content
          first (slower, final assets)
        </Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

export function showExportHelp() {
  renderStatic(<ExportHelpView />);
}
