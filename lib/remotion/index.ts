#!/usr/bin/env bun

/**
 * remotion wrapper for programmatic video creation
 * requires @remotion/cli and remotion packages
 *
 * usage: bun run lib/remotion/index.ts <command> <args>
 *
 * simplified workflow (no cloning needed!):
 * 1. create composition file in lib/remotion/compositions/MyComp.tsx
 * 2. create root file that registers the composition
 * 3. render() directly from lib/remotion/compositions/
 *
 * media files can be:
 * - absolute paths in the composition
 * - relative to sdk root (media/video.mp4)
 * - no need to copy anywhere!
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";

export interface RenderOptions {
  entryPoint: string;
  compositionId: string;
  outputPath: string;
  props?: Record<string, unknown>;
  concurrency?: number;
  frameRange?: [number, number];
}

export interface CompositionInfo {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface CreateCompositionOptions {
  name: string;
  dir?: string;
}

export interface CreateCompositionResult {
  compositionPath: string;
  rootPath: string;
  compositionsDir: string;
}

/**
 * create composition directory structure
 *
 * much simpler than cloning templates!
 * just creates lib/remotion/compositions/ folder if needed
 * agent can then create .tsx files directly there
 *
 * flow:
 * 1. ensure lib/remotion/compositions/ exists
 * 2. return paths for agent to create files
 * 3. no cleanup needed - files stay in repo
 */
export async function createComposition(
  options: CreateCompositionOptions,
): Promise<CreateCompositionResult> {
  const { name, dir } = options;

  // use provided dir or default to lib/remotion/compositions
  const compositionsDir =
    dir || join(process.cwd(), "lib/remotion/compositions");

  // ensure directory exists
  if (!existsSync(compositionsDir)) {
    mkdirSync(compositionsDir, { recursive: true });
    console.log(`[remotion] created directory: ${compositionsDir}`);
  }

  const compositionPath = join(compositionsDir, `${name}.tsx`);
  const rootPath = join(compositionsDir, `${name}.root.tsx`);

  console.log(`[remotion] composition setup ready`);
  console.log(`[remotion] create composition at: ${compositionPath}`);
  console.log(`[remotion] create root at: ${rootPath}`);
  console.log(
    `[remotion] media files can use absolute paths or relative to sdk root`,
  );

  return {
    compositionPath,
    rootPath,
    compositionsDir,
  };
}

/**
 * get list of compositions from entry point
 *
 * flow:
 * 1. bundle the remotion project using webpack
 * 2. extract composition metadata (id, dimensions, fps, duration)
 * 3. return array of composition info
 *
 * useful for listing available compositions before rendering
 */
export async function getCompositionsList(
  entryPoint: string,
): Promise<CompositionInfo[]> {
  if (!existsSync(entryPoint)) {
    throw new Error(`entry point not found: ${entryPoint}`);
  }

  console.log("[remotion] bundling compositions...");

  // step 1: bundle project with webpack (creates serve url)
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("[remotion] fetching compositions...");

  // step 2: extract composition metadata from bundle
  const compositions = await getCompositions(bundleLocation, {
    inputProps: {},
  });

  // step 3: map to simple info objects
  return compositions.map((comp) => ({
    id: comp.id,
    width: comp.width,
    height: comp.height,
    fps: comp.fps,
    durationInFrames: comp.durationInFrames,
  }));
}

/**
 * render a composition to video file
 *
 * flow:
 * 1. bundle the remotion project using webpack
 * 2. get composition metadata (verify it exists)
 * 3. render each frame using chrome headless
 * 4. encode frames to video using ffmpeg
 * 5. save final video to outputPath
 *
 * this is the main rendering function that converts
 * react components into actual video files
 */
export async function render(options: RenderOptions): Promise<string> {
  const {
    entryPoint,
    compositionId,
    outputPath,
    props = {},
    concurrency,
    frameRange,
  } = options;

  if (!entryPoint || !compositionId || !outputPath) {
    throw new Error("entryPoint, compositionId, and outputPath are required");
  }

  if (!existsSync(entryPoint)) {
    throw new Error(`entry point not found: ${entryPoint}`);
  }

  console.log(`[remotion] bundling ${entryPoint}...`);

  // step 1: bundle project with webpack
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("[remotion] getting composition info...");

  // step 2: extract composition metadata
  const compositions = await getCompositions(bundleLocation, {
    inputProps: props,
  });

  // verify composition exists
  const composition = compositions.find((c) => c.id === compositionId);
  if (!composition) {
    throw new Error(
      `composition '${compositionId}' not found. available: ${compositions.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(
    `[remotion] rendering ${composition.id} (${composition.durationInFrames} frames @ ${composition.fps}fps)...`,
  );

  // step 3-5: render frames and encode to video
  // - launches chrome headless to render each frame
  // - uses ffmpeg to encode frames into h264 video
  // - displays progress as it renders
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: props,
    concurrency: concurrency || undefined,
    frameRange: frameRange || undefined,
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      console.log(
        `[remotion] progress: ${(progress * 100).toFixed(1)}% | rendered: ${renderedFrames} | encoded: ${encodedFrames}`,
      );
    },
  });

  console.log(`[remotion] saved to ${outputPath}`);
  return outputPath;
}

/**
 * render a single frame from composition as image
 *
 * flow:
 * 1. bundle the remotion project
 * 2. get composition metadata
 * 3. render specified frame number using chrome
 * 4. save as png/jpeg image
 *
 * useful for creating thumbnails or previews
 */
export async function renderStill(
  entryPoint: string,
  compositionId: string,
  frame: number,
  outputPath: string,
  props?: Record<string, unknown>,
): Promise<string> {
  if (!entryPoint || !compositionId || !outputPath) {
    throw new Error("entryPoint, compositionId, and outputPath are required");
  }

  if (!existsSync(entryPoint)) {
    throw new Error(`entry point not found: ${entryPoint}`);
  }

  console.log(`[remotion] bundling ${entryPoint}...`);

  // step 1: bundle project
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("[remotion] getting composition info...");

  // step 2: get composition metadata
  const compositions = await getCompositions(bundleLocation, {
    inputProps: props || {},
  });

  const composition = compositions.find((c) => c.id === compositionId);
  if (!composition) {
    throw new Error(
      `composition '${compositionId}' not found. available: ${compositions.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(`[remotion] rendering frame ${frame}...`);

  // dynamic import to avoid loading unless needed
  const { renderStill: renderStillFrame } = await import("@remotion/renderer");

  // step 3-4: render single frame and save as image
  await renderStillFrame({
    composition,
    serveUrl: bundleLocation,
    output: outputPath,
    frame,
    inputProps: props || {},
  });

  console.log(`[remotion] saved to ${outputPath}`);
  return outputPath;
}

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run lib/remotion.ts <command> [args]

commands:
  create <name>                                        setup composition directory
  compositions <root-file.tsx>                         list all compositions
  render <root-file.tsx> <comp-id> <output.mp4>       render video
  still <root-file.tsx> <comp-id> <frame> <out.png>   render still frame
  help                                                 show this help

examples:
  bun run lib/remotion/index.ts create MyVideo
  bun run lib/remotion/index.ts compositions lib/remotion/compositions/MyVideo.root.tsx
  bun run lib/remotion/index.ts render lib/remotion/compositions/MyVideo.root.tsx Demo output.mp4
  bun run lib/remotion/index.ts still lib/remotion/compositions/MyVideo.root.tsx Demo 30 frame.png

requirements:
  remotion and @remotion/cli must be installed
  bun install remotion @remotion/cli
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "create": {
        const name = args[1];

        if (!name) {
          throw new Error("composition name is required");
        }

        const result = await createComposition({ name });

        console.log("\ncomposition setup complete!");
        console.log(`\nnext steps:`);
        console.log(`1. create ${result.compositionPath}`);
        console.log(`2. create ${result.rootPath}`);
        console.log(
          `3. render using: bun run lib/remotion/index.ts render ${result.rootPath} <comp-id> output.mp4`,
        );
        break;
      }

      case "compositions": {
        const entryPoint = args[1];

        if (!entryPoint) {
          throw new Error("entry point is required");
        }

        const compositions = await getCompositionsList(entryPoint);

        console.log("\navailable compositions:");
        for (const comp of compositions) {
          console.log(
            `  ${comp.id}: ${comp.width}x${comp.height} @ ${comp.fps}fps (${comp.durationInFrames} frames)`,
          );
        }
        break;
      }

      case "render": {
        const entryPoint = args[1];
        const compositionId = args[2];
        const outputPath = args[3];

        if (!entryPoint || !compositionId || !outputPath) {
          throw new Error(
            "entryPoint, compositionId, and outputPath are required",
          );
        }

        await render({ entryPoint, compositionId, outputPath });
        break;
      }

      case "still": {
        const entryPoint = args[1];
        const compositionId = args[2];
        const frameArg = args[3];
        const outputPath = args[4];

        if (!entryPoint || !compositionId || !frameArg || !outputPath) {
          throw new Error(
            "entryPoint, compositionId, frame, and outputPath are required",
          );
        }

        const frame = Number.parseInt(frameArg, 10);
        if (Number.isNaN(frame)) {
          throw new Error("frame must be a valid number");
        }

        await renderStill(entryPoint, compositionId, frame, outputPath);
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log("run 'bun run lib/remotion.ts help' for usage");
        process.exit(1);
    }
  } catch (error) {
    console.error("[remotion] error:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
