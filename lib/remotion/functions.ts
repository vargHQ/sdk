import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { getCompositionTemplate, getRootTemplate } from "./templates";

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
 * create composition directory structure and template files
 *
 * flow:
 * 1. ensure lib/remotion/compositions/ exists
 * 2. create template composition tsx file
 * 3. create template root tsx file with registerRoot
 * 4. files are ready to customize
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

  // create template composition file
  const compositionTemplate = getCompositionTemplate(name);

  // create template root file
  const rootTemplate = getRootTemplate(name);

  // write files
  writeFileSync(compositionPath, compositionTemplate);
  writeFileSync(rootPath, rootTemplate);

  console.log(`[remotion] created composition: ${compositionPath}`);
  console.log(`[remotion] created root: ${rootPath}`);
  console.log(`\n[remotion] next steps:`);
  console.log(`  1. mkdir -p lib/remotion/public`);
  console.log(`  2. cp media/video.mp4 media/audio.mp3 lib/remotion/public/`);
  console.log(`  3. edit composition to use staticFile("filename.ext")`);
  console.log(
    `  4. bun run lib/remotion/index.ts render ${rootPath} ${name} output.mp4`,
  );

  return {
    compositionPath,
    rootPath,
    compositionsDir,
  };
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
    publicDir: join(process.cwd(), "lib/remotion/public"),
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
      `composition '${compositionId}' not found. available: ${compositions
        .map((c) => c.id)
        .join(", ")}`,
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
        `[remotion] progress: ${(progress * 100).toFixed(
          1,
        )}% | rendered: ${renderedFrames} | encoded: ${encodedFrames}`,
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
      `composition '${compositionId}' not found. available: ${compositions
        .map((c) => c.id)
        .join(", ")}`,
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
