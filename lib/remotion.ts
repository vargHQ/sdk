#!/usr/bin/env bun

/**
 * remotion wrapper for programmatic video creation
 * requires @remotion/cli and remotion packages
 *
 * usage: bun run lib/remotion.ts <command> <args>
 */

import { existsSync } from "node:fs";
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

/**
 * get list of compositions from entry point
 */
export async function getCompositionsList(
  entryPoint: string,
): Promise<CompositionInfo[]> {
  if (!existsSync(entryPoint)) {
    throw new Error(`entry point not found: ${entryPoint}`);
  }

  console.log("[remotion] bundling compositions...");

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("[remotion] fetching compositions...");

  const compositions = await getCompositions(bundleLocation, {
    inputProps: {},
  });

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

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("[remotion] getting composition info...");

  const compositions = await getCompositions(bundleLocation, {
    inputProps: props,
  });

  const composition = compositions.find((c) => c.id === compositionId);
  if (!composition) {
    throw new Error(
      `composition '${compositionId}' not found. available: ${compositions.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(
    `[remotion] rendering ${composition.id} (${composition.durationInFrames} frames @ ${composition.fps}fps)...`,
  );

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
 * render a still frame from composition
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

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log("[remotion] getting composition info...");

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

  const { renderStill: renderStillFrame } = await import("@remotion/renderer");

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
  compositions <entry-point.ts>                        list all compositions
  render <entry-point.ts> <comp-id> <output.mp4>      render video
  still <entry-point.ts> <comp-id> <frame> <out.png>  render still frame
  help                                                 show this help

examples:
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
