import { $ } from "bun";
import { ffprobe, multipleOf2 } from "./ffmpeg";
import {
  getOverlayFilter,
  getTitleFilter,
  getVideoFilterWithTrim,
  processLayer,
} from "./layers";
import type {
  AudioTrack,
  Clip,
  EditlyConfig,
  Layer,
  ProcessedClip,
  TitleLayer,
  VideoLayer,
} from "./types";

export * from "./types";

const DEFAULT_DURATION = 4;
const DEFAULT_TRANSITION = { name: "fade", duration: 0.5 };
const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

interface OverlayVideoUsage {
  path: string;
  inputIndex: number;
  currentTimeOffset: number;
}

async function getVideoDuration(path: string): Promise<number> {
  const info = await ffprobe(path);
  return info.duration;
}

async function getFirstVideoInfo(clips: Clip[]): Promise<{
  width?: number;
  height?: number;
  fps?: number;
}> {
  for (const clip of clips) {
    for (const layer of clip.layers) {
      if (layer.type === "video") {
        const info = await ffprobe((layer as VideoLayer).path);
        return { width: info.width, height: info.height, fps: info.fps };
      }
    }
  }
  return {};
}

async function processClips(
  clips: Clip[],
  defaults: EditlyConfig["defaults"],
): Promise<ProcessedClip[]> {
  const processed: ProcessedClip[] = [];
  const defaultDuration = defaults?.duration ?? DEFAULT_DURATION;
  const defaultTransition = defaults?.transition ?? DEFAULT_TRANSITION;

  for (const clip of clips) {
    let duration = clip.duration ?? defaultDuration;

    for (const layer of clip.layers) {
      if (layer.type === "video" && !clip.duration) {
        const videoLayer = layer as VideoLayer;
        const videoDuration = await getVideoDuration(videoLayer.path);
        const cutFrom = videoLayer.cutFrom ?? 0;
        const cutTo = videoLayer.cutTo ?? videoDuration;
        duration = cutTo - cutFrom;
        break;
      }
    }

    processed.push({
      layers: clip.layers,
      duration,
      transition:
        clip.transition === null
          ? {
              name: "none",
              duration: 0,
              audioOutCurve: "tri",
              audioInCurve: "tri",
            }
          : {
              name: clip.transition?.name ?? defaultTransition.name ?? "fade",
              duration:
                clip.transition?.duration ?? defaultTransition.duration ?? 0.5,
              audioOutCurve: clip.transition?.audioOutCurve ?? "tri",
              audioInCurve: clip.transition?.audioInCurve ?? "tri",
            },
    });
  }

  return processed;
}

function isOverlayLayer(layer: Layer): boolean {
  if (layer.type !== "video") return false;
  const v = layer as VideoLayer;
  return (
    v.width !== undefined ||
    v.height !== undefined ||
    v.left !== undefined ||
    v.top !== undefined
  );
}

function buildBaseClipFilter(
  clip: ProcessedClip,
  clipIndex: number,
  width: number,
  height: number,
  inputOffset: number,
): {
  filters: string[];
  inputs: string[];
  outputLabel: string;
  nextInputOffset: number;
} {
  const filters: string[] = [];
  const inputs: string[] = [];
  let baseLabel = "";
  let inputIdx = inputOffset;

  const baseLayers = clip.layers.filter((l) => l && !isOverlayLayer(l));

  for (let i = 0; i < baseLayers.length; i++) {
    const layer = baseLayers[i];
    if (!layer) continue;

    const layerFilter = processLayer(
      layer,
      inputIdx,
      width,
      height,
      clip.duration,
      false,
    );

    if (layerFilter) {
      let hasFileInput = false;
      for (const input of layerFilter.inputs) {
        if (input.path) {
          inputs.push(input.path);
          hasFileInput = true;
        }
      }
      filters.push(layerFilter.filterComplex);
      baseLabel = layerFilter.outputLabel;
      if (hasFileInput) inputIdx++;
    }

    if (layer.type === "title") {
      const titleFilter = getTitleFilter(
        layer as TitleLayer,
        baseLabel,
        width,
        height,
      );
      const newLabel = `title${clipIndex}_${i}`;
      filters.push(`${titleFilter}[${newLabel}]`);
      baseLabel = newLabel;
    }
  }

  return {
    filters,
    inputs,
    outputLabel: baseLabel,
    nextInputOffset: inputIdx,
  };
}

interface ContinuousOverlay {
  layer: VideoLayer;
  inputIndex: number;
  totalDuration: number;
}

function collectContinuousOverlays(
  clips: ProcessedClip[],
): Map<string, { layer: VideoLayer; totalDuration: number }> {
  const overlays = new Map<
    string,
    { layer: VideoLayer; totalDuration: number }
  >();

  for (const clip of clips) {
    for (const layer of clip.layers) {
      if (layer && isOverlayLayer(layer) && layer.type === "video") {
        const videoLayer = layer as VideoLayer;
        const existing = overlays.get(videoLayer.path);
        if (existing) {
          existing.totalDuration += clip.duration;
        } else {
          overlays.set(videoLayer.path, {
            layer: videoLayer,
            totalDuration: clip.duration,
          });
        }
      }
    }
  }

  return overlays;
}

function buildTransitionFilter(
  fromLabel: string,
  toLabel: string,
  transitionName: string,
  transitionDuration: number,
  offset: number,
  outputLabel: string,
): string {
  if (transitionName === "none" || transitionDuration <= 0) {
    return `[${fromLabel}][${toLabel}]concat=n=2:v=1:a=0[${outputLabel}]`;
  }

  return `[${fromLabel}][${toLabel}]xfade=transition=${transitionName}:duration=${transitionDuration}:offset=${offset}[${outputLabel}]`;
}

function buildAudioFilter(
  videoInputCount: number,
  audioTracks: AudioTrack[],
  audioFilePath?: string,
  keepSourceAudio?: boolean,
  outputVolume?: number | string,
): { inputs: string[]; filter: string; outputLabel: string } | null {
  const audioInputs: string[] = [];
  const audioStreamRefs: string[] = [];
  let inputIdx = videoInputCount;

  if (audioFilePath) {
    audioInputs.push(audioFilePath);
    audioStreamRefs.push(`${inputIdx}:a`);
    inputIdx++;
  }

  for (const track of audioTracks) {
    audioInputs.push(track.path);
    audioStreamRefs.push(`${inputIdx}:a`);
    inputIdx++;
  }

  if (audioStreamRefs.length === 0) {
    return null;
  }

  const volumeFilter = outputVolume ? `,volume=${outputVolume}` : "";
  if (audioStreamRefs.length === 1) {
    return {
      inputs: audioInputs,
      filter: `[${audioStreamRefs[0]}]anull${volumeFilter}[aout]`,
      outputLabel: "aout",
    };
  }

  const mixInputs = audioStreamRefs.map((l) => `[${l}]`).join("");
  return {
    inputs: audioInputs,
    filter: `${mixInputs}amix=inputs=${audioStreamRefs.length}${volumeFilter}[aout]`,
    outputLabel: "aout",
  };
}

export async function editly(config: EditlyConfig): Promise<void> {
  const {
    outPath,
    clips: clipsIn,
    defaults,
    audioFilePath,
    audioTracks = [],
    keepSourceAudio,
    outputVolume,
    customOutputArgs,
    verbose,
    fast,
  } = config;

  if (!clipsIn || clipsIn.length === 0) {
    throw new Error("At least one clip is required");
  }

  const firstVideoInfo = await getFirstVideoInfo(clipsIn);
  let width = config.width ?? firstVideoInfo.width ?? DEFAULT_WIDTH;
  let height = config.height ?? firstVideoInfo.height ?? DEFAULT_HEIGHT;
  const fps = config.fps ?? firstVideoInfo.fps ?? DEFAULT_FPS;

  width = multipleOf2(width);
  height = multipleOf2(height);

  if (fast) {
    const aspectRatio = width / height;
    width = multipleOf2(Math.round(320 * Math.sqrt(aspectRatio)));
    height = multipleOf2(Math.round(320 * Math.sqrt(1 / aspectRatio)));
  }

  if (verbose) {
    console.log(`Output: ${width}x${height} @ ${fps}fps`);
  }

  const clips = await processClips(clipsIn, defaults);

  const continuousOverlays = collectContinuousOverlays(clips);
  const overlayInputs: string[] = [];
  const overlayInputMap = new Map<string, number>();

  for (const [path] of continuousOverlays) {
    overlayInputMap.set(path, overlayInputs.length);
    overlayInputs.push(path);
  }

  const allFilters: string[] = [];
  const allInputs: string[] = [...overlayInputs];
  const clipOutputLabels: string[] = [];
  let inputOffset = overlayInputs.length;

  for (const [i, clip] of clips.entries()) {
    const result = buildBaseClipFilter(clip, i, width, height, inputOffset);

    allFilters.push(...result.filters);
    allInputs.push(...result.inputs);
    clipOutputLabels.push(result.outputLabel);
    inputOffset = result.nextInputOffset;
  }

  let finalVideoLabel = clipOutputLabels[0] ?? "v0";

  if (clipOutputLabels.length > 1) {
    let currentLabel = clipOutputLabels[0] ?? "v0";
    let accumulatedDuration = clips[0]?.duration ?? 0;

    for (let i = 0; i < clips.length - 1; i++) {
      const nextLabel = clipOutputLabels[i + 1] ?? `v${i + 1}`;
      const clip = clips[i];
      const nextClip = clips[i + 1];
      if (!clip) continue;
      const transition = clip.transition;
      const outputLabel = i === clips.length - 2 ? "vfinal" : `vmix${i}`;

      const offset = Math.max(0, accumulatedDuration - transition.duration);

      allFilters.push(
        buildTransitionFilter(
          currentLabel,
          nextLabel,
          transition.name,
          transition.duration,
          offset,
          outputLabel,
        ),
      );

      accumulatedDuration = offset + (nextClip?.duration ?? 0);
      currentLabel = outputLabel;
    }

    finalVideoLabel = "vfinal";
  }

  if (continuousOverlays.size > 0) {
    let totalDuration = 0;
    for (const clip of clips) {
      totalDuration += clip.duration;
    }
    for (let i = 0; i < clips.length - 1; i++) {
      const clip = clips[i];
      if (clip) {
        totalDuration -= clip.transition.duration;
      }
    }

    let currentBase = finalVideoLabel;
    let overlayIdx = 0;

    for (const [path, { layer }] of continuousOverlays) {
      const inputIndex = overlayInputMap.get(path);
      if (inputIndex === undefined) continue;

      const trimmedLabel = `ovfinal${overlayIdx}`;
      const layerFilter = getVideoFilterWithTrim(
        layer,
        inputIndex,
        width,
        height,
        0,
        totalDuration,
        trimmedLabel,
        true,
      );
      allFilters.push(layerFilter.filterComplex);

      const outputLabel = `vwithov${overlayIdx}`;
      const overlayFilter = getOverlayFilter(
        currentBase,
        trimmedLabel,
        layer,
        width,
        height,
        outputLabel,
      );
      allFilters.push(overlayFilter);

      currentBase = outputLabel;
      overlayIdx++;
    }

    finalVideoLabel = currentBase;
  }

  const videoInputCount = allInputs.length;
  const audioFilter = buildAudioFilter(
    videoInputCount,
    audioTracks,
    audioFilePath,
    keepSourceAudio,
    outputVolume,
  );

  if (audioFilter) {
    allInputs.push(...audioFilter.inputs);
    allFilters.push(audioFilter.filter);
  }

  const inputArgs = allInputs.flatMap((input) => ["-i", input]);
  const filterComplex = allFilters.join(";");

  const outputArgs = customOutputArgs ?? [
    "-c:v",
    "libx264",
    "-preset",
    fast ? "ultrafast" : "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  const mapArgs = audioFilter
    ? ["-map", `[${finalVideoLabel}]`, "-map", `[${audioFilter.outputLabel}]`]
    : ["-map", `[${finalVideoLabel}]`];

  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    verbose ? "info" : "error",
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    ...mapArgs,
    "-r",
    String(fps),
    ...outputArgs,
    "-y",
    outPath,
  ];

  if (verbose) {
    console.log("ffmpeg", ffmpegArgs.join(" "));
    console.log("\nFilter complex:\n", filterComplex.split(";").join(";\n"));
  }

  const result = await $`ffmpeg ${ffmpegArgs}`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.exitCode}`);
  }

  console.log(`Output: ${outPath}`);
}

export default editly;
