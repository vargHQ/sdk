#!/usr/bin/env bun

/**
 * remotion wrapper for programmatic video creation
 * requires @remotion/cli and remotion packages
 *
 * usage: bun run lib/remotion.ts <command> <args>
 *
 * typical workflow:
 * 1. createProject() - creates new remotion project from template in temp dir
 * 2. agent edits project files (compositions, components, etc)
 * 3. render() - bundles and renders the composition to video
 * 4. optional: cleanup() to remove temp directory
 */

import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

export interface CreateProjectOptions {
  templateUrl?: string;
  dir?: string;
}

export interface CreateProjectResult {
  projectDir: string;
  entryPoint: string;
  cleanup: () => void;
}

/**
 * create a new remotion project from template in temp directory
 *
 * flow:
 * 1. clone template repository (default: caffeinum/remotion-template)
 * 2. install dependencies with bun
 * 3. return projectDir path for agent to edit
 * 4. return entryPoint (src/index.ts) for rendering
 * 5. return cleanup() function to delete temp dir (optional)
 *
 * after calling this, agent can:
 * - edit src/*.tsx files to create/modify compositions
 * - copy media files to public/ directory
 * - modify package.json, tsconfig.json, etc
 * - then call render() to generate video
 */
export async function createProject(
  options: CreateProjectOptions = {},
): Promise<CreateProjectResult> {
  const templateUrl =
    options.templateUrl || "https://github.com/caffeinum/remotion-template.git";

  // generate unique temp directory name with timestamp + random suffix
  const projectDir =
    options.dir ||
    join(
      tmpdir(),
      `remotion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    );

  console.log(`[remotion] creating project from ${templateUrl}...`);
  console.log(`[remotion] directory: ${projectDir}`);

  // step 1: clone git template repository
  const cloneProc = Bun.spawn(["git", "clone", templateUrl, projectDir], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await cloneProc.exited;

  if (cloneProc.exitCode !== 0) {
    const error = await new Response(cloneProc.stderr).text();
    throw new Error(`failed to clone template: ${error}`);
  }

  console.log("[remotion] installing dependencies...");

  // step 2: install npm packages with bun
  const installProc = Bun.spawn(["bun", "install"], {
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  await installProc.exited;

  if (installProc.exitCode !== 0) {
    const error = await new Response(installProc.stderr).text();
    throw new Error(`failed to install dependencies: ${error}`);
  }

  const entryPoint = join(projectDir, "src/index.ts");

  console.log("[remotion] project ready!");
  console.log(`[remotion] entry point: ${entryPoint}`);

  // return paths and cleanup function
  return {
    projectDir,
    entryPoint,
    cleanup: () => {
      console.log(`[remotion] cleaning up ${projectDir}...`);
      rmSync(projectDir, { recursive: true, force: true });
    },
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
  create [template-url]                                create new project from template
  compositions <entry-point.ts>                        list all compositions
  render <entry-point.ts> <comp-id> <output.mp4>      render video
  still <entry-point.ts> <comp-id> <frame> <out.png>  render still frame
  help                                                 show this help

examples:
  bun run lib/remotion.ts create
  bun run lib/remotion.ts create https://github.com/user/template.git
  bun run lib/remotion.ts compositions src/index.ts
  bun run lib/remotion.ts render src/index.ts MyVideo output.mp4
  bun run lib/remotion.ts still src/index.ts MyVideo 30 frame.png

requirements:
  remotion and @remotion/cli must be installed
  bun install remotion @remotion/cli
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "create": {
        const templateUrl = args[1];

        const result = await createProject({
          templateUrl,
        });

        console.log("\nproject created successfully!");
        console.log(`directory: ${result.projectDir}`);
        console.log(`entry point: ${result.entryPoint}`);
        console.log("\nnote: cleanup() available but not called automatically");
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
