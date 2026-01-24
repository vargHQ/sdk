/** @jsxImportSource react */

import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { generateImage, wrapImageModel } from "ai";
import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { withCache } from "../../ai-sdk/cache";
import { fileCache } from "../../ai-sdk/file-cache";
import { imagePlaceholderFallbackMiddleware } from "../../ai-sdk/middleware";
import { computeCacheKey } from "../../react/renderers/utils";
import type {
  ClipProps,
  ImageInput,
  ImagePrompt,
  ImageProps,
  RenderProps,
  VargElement,
  VideoProps,
} from "../../react/types";
import { Header, HelpBlock, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

const AUTO_IMPORTS = `/** @jsxImportSource vargai */
import { Captions, Clip, Image, Music, Overlay, Packshot, Render, Slider, Speech, Split, Subtitle, Swipe, TalkingHead, Title, Video, Grid, SplitLayout } from "vargai/react";
import { fal, elevenlabs, replicate } from "vargai/ai";
`;

interface FrameInfo {
  clipIndex: number;
  prompt?: ImagePrompt;
  src?: string;
  model?: unknown;
  aspectRatio?: string;
  duration: number;
  startTime: number;
  imageElement?: VargElement<"image">;
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
  const tmpDir = `${pkgDir}/.cache/varg-frame`;

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

function toFileUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("file://")) {
    return pathOrUrl;
  }
  const resolved = resolve(pathOrUrl);
  return `file://${resolved}`;
}

interface ImageGeneratorContext {
  generateImage: typeof generateImage;
  defaultModel?: unknown;
}

async function resolveImageInput(
  input: ImageInput,
  ctx: ImageGeneratorContext,
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  if (
    input &&
    typeof input === "object" &&
    "type" in input &&
    input.type === "image"
  ) {
    const imageElement = input as VargElement<"image">;
    const props = imageElement.props as ImageProps;

    if (props.src) {
      const response = await fetch(toFileUrl(props.src));
      return new Uint8Array(await response.arrayBuffer());
    }

    if (props.prompt) {
      const model = props.model ?? ctx.defaultModel;
      if (!model) {
        throw new Error("Nested image requires model");
      }

      const resolvedPrompt = await resolvePromptForGeneration(
        props.prompt,
        ctx,
      );
      const cacheKey = computeCacheKey(imageElement);

      const { images } = await ctx.generateImage({
        model: model as Parameters<typeof generateImage>[0]["model"],
        prompt: resolvedPrompt,
        aspectRatio: props.aspectRatio as `${number}:${number}` | undefined,
        n: 1,
        cacheKey,
      } as Parameters<typeof generateImage>[0]);

      const firstImage = images[0];
      if (!firstImage?.uint8Array) {
        throw new Error("Nested image generation returned no data");
      }
      return firstImage.uint8Array;
    }

    throw new Error("Image element requires prompt or src");
  }
  throw new Error("Unknown image input type");
}

function extractFrameFromVideo(element: VargElement<"video">): {
  prompt?: ImagePrompt;
  nestedImage?: VargElement<"image">;
} {
  const props = element.props as VideoProps;

  if (props.src) {
    return {};
  }

  const prompt = props.prompt;
  if (!prompt) {
    return {};
  }

  if (typeof prompt === "string") {
    return { prompt };
  }

  if (prompt.images && prompt.images.length > 0) {
    const firstImage = prompt.images[0];
    if (
      firstImage &&
      typeof firstImage === "object" &&
      "type" in firstImage &&
      firstImage.type === "image"
    ) {
      return { nestedImage: firstImage as VargElement<"image"> };
    }
    return { prompt: { text: prompt.text, images: prompt.images } };
  }

  if (prompt.text) {
    return { prompt: prompt.text };
  }

  return {};
}

function extractFrames(element: VargElement): FrameInfo[] {
  const frames: FrameInfo[] = [];
  let currentTime = 0;
  let clipIndex = 0;

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      const clipProps = childElement.props as ClipProps;
      const duration =
        typeof clipProps.duration === "number" ? clipProps.duration : 3;

      for (const clipChild of childElement.children) {
        if (
          !clipChild ||
          typeof clipChild !== "object" ||
          !("type" in clipChild)
        )
          continue;

        const clipChildElement = clipChild as VargElement;

        if (clipChildElement.type === "image") {
          const props = clipChildElement.props as ImageProps;
          frames.push({
            clipIndex,
            prompt: props.prompt,
            src: props.src,
            model: props.model,
            aspectRatio: props.aspectRatio,
            duration,
            startTime: currentTime,
            imageElement: clipChildElement as VargElement<"image">,
          });
          break;
        }

        if (clipChildElement.type === "video") {
          const { prompt, nestedImage } = extractFrameFromVideo(
            clipChildElement as VargElement<"video">,
          );
          const videoProps = clipChildElement.props as VideoProps;

          if (nestedImage) {
            const imageProps = nestedImage.props as ImageProps;
            frames.push({
              clipIndex,
              prompt: imageProps.prompt,
              src: imageProps.src,
              model: imageProps.model,
              aspectRatio: imageProps.aspectRatio ?? videoProps.aspectRatio,
              duration,
              startTime: currentTime,
              imageElement: nestedImage,
            });
          } else if (prompt) {
            frames.push({
              clipIndex,
              prompt,
              model: undefined,
              aspectRatio: videoProps.aspectRatio,
              duration,
              startTime: currentTime,
            });
          }
          break;
        }
      }

      currentTime += duration;
      clipIndex++;
    }
  }

  return frames;
}

function findClipAtTime(
  frames: FrameInfo[],
  time: number,
): FrameInfo | undefined {
  for (const frame of frames) {
    if (time >= frame.startTime && time < frame.startTime + frame.duration) {
      return frame;
    }
  }
  return frames[frames.length - 1];
}

async function detectDefaultImageModel() {
  const falKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (falKey) {
    const { fal } = await import("../../ai-sdk/providers/fal");
    return fal.imageModel("flux-schnell");
  }
  return undefined;
}

async function resolvePromptForGeneration(
  prompt: ImagePrompt,
  ctx: ImageGeneratorContext,
): Promise<string | { text?: string; images: Uint8Array[] }> {
  if (typeof prompt === "string") {
    return prompt;
  }

  const resolvedImages: Uint8Array[] = [];
  for (const img of prompt.images) {
    const resolved = await resolveImageInput(img, ctx);
    if (resolved) {
      resolvedImages.push(resolved);
    }
  }

  return { text: prompt.text, images: resolvedImages };
}

export const frameCmd = defineCommand({
  meta: {
    name: "frame",
    description: "render still frames from component clips",
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
      description: "output path pattern (use %d for clip number)",
    },
    at: {
      type: "string" as const,
      description: "render frame at specific timestamp (e.g., 2.5)",
    },
    clip: {
      type: "string" as const,
      alias: "c",
      description: "render specific clip number only (1-indexed)",
    },
    all: {
      type: "boolean" as const,
      alias: "a",
      description: "render all clips (default if no --at or --clip)",
      default: false,
    },
    cache: {
      type: "string" as const,
      description: "cache directory",
      default: ".cache/ai",
    },
    quiet: {
      type: "boolean" as const,
      alias: "q",
      description: "minimal output",
      default: false,
    },
    preview: {
      type: "boolean" as const,
      description: "use placeholder images (no AI generation)",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;

    if (!file) {
      console.error("usage: varg frame <component.tsx> [options]");
      process.exit(1);
    }

    const component = await loadComponent(file);

    if (!component || component.type !== "render") {
      console.error("error: default export must be a <Render> element");
      process.exit(1);
    }

    const renderProps = component.props as RenderProps;
    const frames = extractFrames(component);

    if (frames.length === 0) {
      console.error("error: no clips with visual elements found");
      process.exit(1);
    }

    let framesToRender: FrameInfo[] = [];

    if (args.at) {
      const time = Number.parseFloat(args.at as string);
      const frame = findClipAtTime(frames, time);
      if (frame) {
        framesToRender = [frame];
      } else {
        console.error(`error: no clip found at timestamp ${time}s`);
        process.exit(1);
      }
    } else if (args.clip) {
      const clipNum = Number.parseInt(args.clip as string, 10) - 1;
      const frame = frames.find((f) => f.clipIndex === clipNum);
      if (frame) {
        framesToRender = [frame];
      } else {
        console.error(
          `error: clip ${args.clip} not found (have ${frames.length} clips)`,
        );
        process.exit(1);
      }
    } else {
      framesToRender = frames;
    }

    const baseName = basename(file).replace(/\.tsx?$/, "");
    const outputDir = dirname(
      (args.output as string) ?? `output/${baseName}-frame-1.png`,
    );

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const defaultModel = await detectDefaultImageModel();

    const cache = args.cache
      ? fileCache({ dir: args.cache as string })
      : undefined;
    const cachedGenerateImage = cache
      ? withCache(generateImage, { storage: cache })
      : generateImage;

    const wrapGenerateImage: typeof generateImage = async (opts) => {
      if (args.preview) {
        if (
          typeof opts.model === "string" ||
          opts.model.specificationVersion !== "v3"
        ) {
          return cachedGenerateImage(opts);
        }
        const wrappedModel = wrapImageModel({
          model: opts.model,
          middleware: imagePlaceholderFallbackMiddleware({
            mode: "preview",
            onFallback: () => {},
          }),
        });
        return generateImage({ ...opts, model: wrappedModel });
      }
      return cachedGenerateImage(opts);
    };

    const outputPaths: string[] = [];

    for (const frame of framesToRender) {
      const outputPath =
        (args.output as string)?.replace("%d", String(frame.clipIndex + 1)) ??
        `output/${baseName}-frame-${frame.clipIndex + 1}.png`;

      if (!args.quiet) {
        console.log(`rendering clip ${frame.clipIndex + 1}...`);
      }

      if (frame.src) {
        const response = await fetch(toFileUrl(frame.src));
        const data = new Uint8Array(await response.arrayBuffer());
        await Bun.write(outputPath, data);
        outputPaths.push(outputPath);
        continue;
      }

      if (!frame.prompt) {
        if (!args.quiet) {
          console.log(
            `  skipping clip ${frame.clipIndex + 1} (no prompt or src)`,
          );
        }
        continue;
      }

      const model = frame.model ?? defaultModel;
      if (!model) {
        console.error(
          "error: no image model available. set FAL_API_KEY or specify model in component",
        );
        process.exit(1);
      }

      const generatorCtx: ImageGeneratorContext = {
        generateImage: wrapGenerateImage,
        defaultModel,
      };

      const resolvedPrompt = await resolvePromptForGeneration(
        frame.prompt,
        generatorCtx,
      );

      const cacheKey = frame.imageElement
        ? computeCacheKey(frame.imageElement)
        : undefined;

      const { images } = await wrapGenerateImage({
        model: model as Parameters<typeof generateImage>[0]["model"],
        prompt: resolvedPrompt,
        aspectRatio: frame.aspectRatio as `${number}:${number}` | undefined,
        n: 1,
        cacheKey,
      } as Parameters<typeof generateImage>[0]);

      const firstImage = images[0];
      if (!firstImage?.uint8Array) {
        console.error(
          `error: image generation returned no data for clip ${frame.clipIndex + 1}`,
        );
        continue;
      }

      await Bun.write(outputPath, firstImage.uint8Array);
      outputPaths.push(outputPath);

      if (!args.quiet) {
        console.log(`  → ${outputPath}`);
      }
    }

    if (!args.quiet) {
      console.log(`\ndone! ${outputPaths.length} frame(s) rendered`);
    }
  },
});

function FrameHelpView() {
  const examples = [
    {
      command: "varg frame video.tsx",
      description: "render all clips as frames",
    },
    {
      command: "varg frame video.tsx --clip 2",
      description: "render only clip 2",
    },
    {
      command: "varg frame video.tsx --at 5.5",
      description: "render frame at 5.5 seconds",
    },
    {
      command: "varg frame video.tsx -o frames/shot-%d.png",
      description: "custom output pattern",
    },
  ];

  return (
    <VargBox title="varg frame">
      <Box marginBottom={1}>
        <Text>
          render still frames from component clips. extracts the first visual
          element from each clip and generates as png.
        </Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg frame {"<file.tsx>"} [options]
        </VargText>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>
          <VargText variant="accent">-o, --output </VargText>output path pattern
          (use %d for clip number)
        </Text>
        <Text>
          <VargText variant="accent">--at </VargText>render frame at specific
          timestamp (seconds)
        </Text>
        <Text>
          <VargText variant="accent">-c, --clip </VargText>render specific clip
          number only (1-indexed)
        </Text>
        <Text>
          <VargText variant="accent">-a, --all </VargText>render all clips
          (default)
        </Text>
        <Text>
          <VargText variant="accent">--cache </VargText>cache directory
          (default: .cache/ai)
        </Text>
        <Text>
          <VargText variant="accent">--preview </VargText>use placeholder images
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

export function showFrameHelp() {
  renderStatic(<FrameHelpView />);
}
