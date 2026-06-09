/** @jsxImportSource react */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { render } from "../../react/render";
import type { DefaultModels } from "../../react/types";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";
import { detectDefaultModels, loadComponent, sharedArgs } from "./render.tsx";

const DEFAULT_PRERENDER_IMAGE_MODEL = "nano-banana-2";

export const prerenderCmd = defineCommand({
  meta: {
    name: "prerender",
    description:
      "render with real images + speech but still-frame video (no video generation)",
  },
  args: {
    ...sharedArgs,
    "image-model": {
      type: "string" as const,
      description: `image model for t2v replacement (default: ${DEFAULT_PRERENDER_IMAGE_MODEL})`,
    },
  },
  async run({ args }) {
    const file = args.file as string;

    if (!file) {
      console.error(
        "usage: varg prerender <component.tsx> [-o output.mp4] [--image-model nano-banana-2]",
      );
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
    const outputPath =
      (args.output as string) ?? `output/${basename}-prerender.mp4`;

    mkdirSync(dirname(outputPath), { recursive: true });

    if (!args.quiet) {
      console.log(`prerendering ${file} → ${outputPath}`);
    }

    const useCache = !args["no-cache"];

    const defaults = await detectDefaultModels();

    // Resolve the prerender image model
    const imageModelId =
      (args["image-model"] as string) ?? DEFAULT_PRERENDER_IMAGE_MODEL;
    const prerenderImageModel = await resolvePrerenderImageModel(
      imageModelId,
      defaults,
    );

    const result = await render(component, {
      output: outputPath,
      cache: useCache ? (args.cache as string) : undefined,
      mode: "prerender",
      defaults: {
        ...defaults,
        prerenderImage: prerenderImageModel,
      },
      verbose: args.verbose as boolean,
    });

    if (!args.quiet) {
      console.log(`done! ${result.video.byteLength} bytes → ${outputPath}`);
    }

    if (args.open) {
      const { $ } = await import("bun");
      await $`open ${outputPath}`.quiet();
    }
  },
});

/**
 * Resolve the prerender image model from a model ID string.
 * Uses the same provider detection logic as detectDefaultModels.
 */
async function resolvePrerenderImageModel(
  modelId: string,
  defaults?: DefaultModels,
) {
  // Try varg gateway first
  let hasVargKey = !!process.env.VARG_API_KEY;
  if (!hasVargKey) {
    try {
      const { getGlobalApiKey } = await import("../credentials");
      hasVargKey = !!getGlobalApiKey();
    } catch {
      // credentials module may not be available
    }
  }

  if (hasVargKey) {
    const { varg } = await import("../../ai-sdk/providers/varg");
    return varg.imageModel(modelId);
  }

  // Fall back to fal
  const falKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (falKey) {
    const { fal } = await import("../../ai-sdk/providers/fal");
    return fal.imageModel(modelId);
  }

  // Fall back to default image model
  if (defaults?.image) {
    return defaults.image;
  }

  throw new Error(
    `Cannot resolve prerender image model '${modelId}'. Set VARG_API_KEY or FAL_API_KEY.`,
  );
}

function PrerenderHelpView() {
  const examples = [
    {
      command: "varg prerender video.tsx",
      description: "prerender to output/video-prerender.mp4",
    },
    {
      command: "varg prerender video.tsx -o preview.mp4",
      description: "custom output path",
    },
    {
      command: "varg prerender video.tsx --image-model flux-schnell",
      description: "use flux-schnell for t2v replacement",
    },
    {
      command: "varg prerender video.tsx --open",
      description: "prerender and open in player",
    },
  ];

  return (
    <VargBox title="varg prerender">
      <Box marginBottom={1}>
        <Text>
          render with real images and speech but replace video generation with
          still frames. generates images for text-to-video clips using a fast
          image model (default: {DEFAULT_PRERENDER_IMAGE_MODEL}) and uses input
          images directly for image-to-video clips. produces a slideshow video
          with exact clip durations for visual-audio sync review.
        </Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg prerender {"<file.tsx>"} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">-o, --output </VargText>output path
          (default: output/{"<name>"}-prerender.mp4)
        </Text>
        <Text>
          <VargText variant="accent">--image-model </VargText>image model for
          t2v replacement (default: {DEFAULT_PRERENDER_IMAGE_MODEL})
        </Text>
        <Text>
          <VargText variant="accent">-c, --cache </VargText>cache directory
          (default: .cache/ai)
        </Text>
        <Text>
          <VargText variant="accent">--no-cache </VargText>disable cache
        </Text>
        <Text>
          <VargText variant="accent">-v, --verbose </VargText>show ffmpeg
          commands
        </Text>
        <Text>
          <VargText variant="accent">--open </VargText>open video after
          generation
        </Text>
        <Text>
          <VargText variant="accent">-q, --quiet </VargText>minimal output
        </Text>
      </Box>

      <Header>COST COMPARISON</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          prerender generates real speech + images but skips expensive video
        </Text>
        <Text>
          generation (Kling, Wan, etc.). typical savings: $1-4 per render.
        </Text>
        <Text> </Text>
        <Text>preview → free (placeholders only, no AI generation)</Text>
        <Text>
          prerender → ~$0.50 (real images + speech, still-frame video)
        </Text>
        <Text>render → ~$3-5 (full AI video generation)</Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box marginTop={1}>
        <HelpBlock examples={examples} />
      </Box>
    </VargBox>
  );
}

export function showPrerenderHelp() {
  renderStatic(<PrerenderHelpView />);
}
