import { $ } from "bun";
import { ffprobe, multipleOf2 } from "./ffmpeg";
import {
  getImageOverlayFilter,
  getImageOverlayPositionFilter,
  getNewsTitleFilter,
  getOverlayFilter,
  getSlideInTextFilter,
  getSubtitleFilter,
  getTitleFilter,
  getVideoFilterWithTrim,
  processLayer,
} from "./layers";
import type {
  AudioLayer,
  AudioNormalizationOptions,
  AudioTrack,
  Clip,
  DetachedAudioLayer,
  EditlyConfig,
  ImageOverlayLayer,
  Layer,
  NewsTitleLayer,
  ProcessedClip,
  SlideInTextLayer,
  SubtitleLayer,
  TitleLayer,
  VideoLayer,
} from "./types";

export * from "./types";

const DEFAULT_DURATION = 4;
const DEFAULT_TRANSITION = { name: "fade", duration: 0.5 };
const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

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

function applyLayerDefaults(
  layer: Layer,
  defaults: EditlyConfig["defaults"],
): Layer {
  if (!defaults) return layer;

  const layerDefaults = defaults.layer ?? {};
  const typeDefaults = defaults.layerType?.[layer.type] ?? {};

  return { ...layerDefaults, ...typeDefaults, ...layer } as Layer;
}

async function processClips(
  clips: Clip[],
  defaults: EditlyConfig["defaults"],
): Promise<ProcessedClip[]> {
  const processed: ProcessedClip[] = [];
  const defaultDuration = defaults?.duration ?? DEFAULT_DURATION;
  const defaultTransition = defaults?.transition ?? DEFAULT_TRANSITION;

  for (const clip of clips) {
    const layers = clip.layers.map((layer) =>
      applyLayerDefaults(layer, defaults),
    );
    let duration = clip.duration ?? defaultDuration;

    for (const layer of layers) {
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
      layers,
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

function isVideoOverlayLayer(layer: Layer): boolean {
  if (layer.type !== "video") return false;
  const v = layer as VideoLayer;
  return (
    v.width !== undefined ||
    v.height !== undefined ||
    v.left !== undefined ||
    v.top !== undefined
  );
}

function isImageOverlayLayer(layer: Layer): boolean {
  return layer.type === "image-overlay";
}

function isOverlayLayer(layer: Layer): boolean {
  return isVideoOverlayLayer(layer) || isImageOverlayLayer(layer);
}

function isTextOverlayLayer(layer: Layer): boolean {
  return (
    layer.type === "title" ||
    layer.type === "subtitle" ||
    layer.type === "news-title" ||
    layer.type === "slide-in-text"
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
  videoSources: {
    inputIndex: number;
    cutFrom: number;
    mixVolume?: number | string;
  }[];
} {
  const filters: string[] = [];
  const inputs: string[] = [];
  const videoSources: {
    inputIndex: number;
    cutFrom: number;
    mixVolume?: number | string;
  }[] = [];
  let baseLabel = "";
  let inputIdx = inputOffset;

  // Filter out overlay layers AND text overlay layers (text will be applied after image overlays)
  const baseLayers = clip.layers.filter(
    (l) => l && !isOverlayLayer(l) && !isTextOverlayLayer(l),
  );

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
      if (hasFileInput) {
        if (layer.type === "video" && !isVideoOverlayLayer(layer)) {
          const videoLayer = layer as VideoLayer;
          videoSources.push({
            inputIndex: inputIdx,
            cutFrom: videoLayer.cutFrom ?? 0,
            mixVolume: videoLayer.mixVolume,
          });
        }
        inputIdx++;
      }
    }
  }

  return {
    filters,
    inputs,
    outputLabel: baseLabel,
    nextInputOffset: inputIdx,
    videoSources,
  };
}

function collectContinuousVideoOverlays(
  clips: ProcessedClip[],
): Map<string, { layer: VideoLayer; totalDuration: number }> {
  const overlays = new Map<
    string,
    { layer: VideoLayer; totalDuration: number }
  >();

  for (const clip of clips) {
    for (const layer of clip.layers) {
      if (layer && isVideoOverlayLayer(layer)) {
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

function collectImageOverlays(
  clips: ProcessedClip[],
): Map<string, { layer: ImageOverlayLayer; totalDuration: number }> {
  const overlays = new Map<
    string,
    { layer: ImageOverlayLayer; totalDuration: number }
  >();

  for (const clip of clips) {
    for (const layer of clip.layers) {
      if (layer && isImageOverlayLayer(layer)) {
        const imgLayer = layer as ImageOverlayLayer;
        const existing = overlays.get(imgLayer.path);
        if (existing) {
          existing.totalDuration += clip.duration;
        } else {
          overlays.set(imgLayer.path, {
            layer: imgLayer,
            totalDuration: clip.duration,
          });
        }
      }
    }
  }

  return overlays;
}

function collectAudioLayers(
  clips: ProcessedClip[],
): { layer: AudioLayer | DetachedAudioLayer; clipStartTime: number }[] {
  const audioLayers: {
    layer: AudioLayer | DetachedAudioLayer;
    clipStartTime: number;
  }[] = [];
  let currentTime = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (!clip) continue;

    for (const layer of clip.layers) {
      if (layer && layer.type === "audio") {
        audioLayers.push({
          layer: layer as AudioLayer,
          clipStartTime: currentTime,
        });
      }
      if (layer && layer.type === "detached-audio") {
        const detached = layer as DetachedAudioLayer;
        audioLayers.push({
          layer: detached,
          clipStartTime: currentTime + (detached.start ?? 0),
        });
      }
    }

    currentTime += clip.duration;
    if (i < clips.length - 1) {
      currentTime -= clip.transition.duration;
    }
  }

  return audioLayers;
}

type TextLayer = TitleLayer | SubtitleLayer | NewsTitleLayer | SlideInTextLayer;

interface TimedTextLayer {
  layer: TextLayer;
  startTime: number;
  duration: number;
}

function collectTextLayers(clips: ProcessedClip[]): TimedTextLayer[] {
  const textLayers: TimedTextLayer[] = [];
  let currentTime = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (!clip) continue;

    for (const layer of clip.layers) {
      if (layer && isTextOverlayLayer(layer)) {
        textLayers.push({
          layer: layer as TextLayer,
          startTime: currentTime,
          duration: clip.duration,
        });
      }
    }

    currentTime += clip.duration;
    if (i < clips.length - 1) {
      currentTime -= clip.transition.duration;
    }
  }

  return textLayers;
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
    return `[${fromLabel}][${toLabel}]concat=n=2:v=1:a=0,settb=1/30[${outputLabel}]`;
  }

  // settb=1/30 ensures consistent timebase for chained xfades
  return `[${fromLabel}][${toLabel}]xfade=transition=${transitionName}:duration=${transitionDuration}:offset=${offset},settb=1/30[${outputLabel}]`;
}

interface VideoSourceAudio {
  inputIndex: number;
  startTime: number;
  duration: number;
  cutFrom: number;
  mixVolume?: number | string;
  fadeOutDuration?: number;
  fadeOutCurve?: string;
  fadeInDuration?: number;
  fadeInCurve?: string;
}

function buildAudioFilter(
  videoInputCount: number,
  audioTracks: AudioTrack[],
  clipAudioLayers: {
    layer: AudioLayer | DetachedAudioLayer;
    clipStartTime: number;
  }[],
  totalDuration: number,
  audioFilePath?: string,
  loopAudio?: boolean,
  keepSourceAudio?: boolean,
  outputVolume?: number | string,
  videoSourceAudio?: VideoSourceAudio[],
  clipsAudioVolume?: number | string,
  audioNorm?: AudioNormalizationOptions,
): { inputs: string[]; filter: string; outputLabel: string } | null {
  const audioInputs: string[] = [];
  const filterParts: string[] = [];
  const mixLabels: string[] = [];
  let inputIdx = videoInputCount;

  if (videoSourceAudio && videoSourceAudio.length > 0) {
    for (let i = 0; i < videoSourceAudio.length; i++) {
      const src = videoSourceAudio[i]!;
      const { inputIndex, startTime, duration, cutFrom, mixVolume } = src;

      const shouldInclude =
        keepSourceAudio || (mixVolume !== undefined && mixVolume !== 0);
      if (!shouldInclude) continue;

      const label = `vsrc${i}`;
      let audioFilter = `[${inputIndex}:a]`;
      audioFilter += `atrim=${cutFrom}:${cutFrom + duration},asetpts=PTS-STARTPTS,`;

      const volume = mixVolume ?? clipsAudioVolume;
      if (volume !== undefined) {
        audioFilter += `volume=${volume},`;
      }
      if (src.fadeInDuration) {
        audioFilter += `afade=t=in:st=0:d=${src.fadeInDuration}:curve=${src.fadeInCurve ?? "tri"},`;
      }
      if (src.fadeOutDuration) {
        const fadeOutStart = duration - src.fadeOutDuration;
        audioFilter += `afade=t=out:st=${fadeOutStart}:d=${src.fadeOutDuration}:curve=${src.fadeOutCurve ?? "tri"},`;
      }
      audioFilter += `adelay=${Math.round(startTime * 1000)}|${Math.round(startTime * 1000)}`;
      audioFilter += `[${label}]`;
      filterParts.push(audioFilter);
      mixLabels.push(label);
    }
  }

  if (audioFilePath) {
    audioInputs.push(audioFilePath);
    const label = `abg${inputIdx}`;
    if (loopAudio) {
      filterParts.push(
        `[${inputIdx}:a]aloop=loop=-1:size=2e9,atrim=0:${totalDuration}[${label}]`,
      );
    } else {
      filterParts.push(`[${inputIdx}:a]anull[${label}]`);
    }
    mixLabels.push(label);
    inputIdx++;
  }

  for (let i = 0; i < audioTracks.length; i++) {
    const track = audioTracks[i]!;
    audioInputs.push(track.path);
    const label = `atrk${i}`;

    let audioFilter = `[${inputIdx}:a]`;
    if (track.cutFrom !== undefined || track.cutTo !== undefined) {
      const start = track.cutFrom ?? 0;
      const end = track.cutTo ?? 999999;
      audioFilter += `atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,`;
    }
    if (track.mixVolume !== undefined) {
      audioFilter += `volume=${track.mixVolume},`;
    }
    const startMs = Math.round((track.start ?? 0) * 1000);
    audioFilter += `adelay=${startMs}|${startMs}`;
    audioFilter += `[${label}]`;

    filterParts.push(audioFilter);
    mixLabels.push(label);
    inputIdx++;
  }

  for (let i = 0; i < clipAudioLayers.length; i++) {
    const { layer, clipStartTime } = clipAudioLayers[i]!;
    audioInputs.push(layer.path);
    const label = `aclip${i}`;

    let audioFilter = `[${inputIdx}:a]`;
    if (layer.cutFrom !== undefined || layer.cutTo !== undefined) {
      const start = layer.cutFrom ?? 0;
      const end = layer.cutTo ?? 999999;
      audioFilter += `atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,`;
    }
    if (layer.mixVolume !== undefined) {
      audioFilter += `volume=${layer.mixVolume},`;
    }
    audioFilter += `adelay=${Math.round(clipStartTime * 1000)}|${Math.round(clipStartTime * 1000)}`;
    audioFilter += `[${label}]`;

    filterParts.push(audioFilter);
    mixLabels.push(label);
    inputIdx++;
  }

  if (mixLabels.length === 0) {
    return null;
  }

  let postFilters = "";
  if (audioNorm?.enable !== false && audioNorm) {
    const gaussSize = audioNorm.gaussSize ?? 5;
    const maxGain = audioNorm.maxGain ?? 25;
    postFilters += `,dynaudnorm=g=${gaussSize}:maxgain=${maxGain}`;
  }
  if (outputVolume) {
    postFilters += `,volume=${outputVolume}`;
  }

  if (mixLabels.length === 1) {
    return {
      inputs: audioInputs,
      filter: `${filterParts.join(";")};[${mixLabels[0]}]anull${postFilters}[aout]`,
      outputLabel: "aout",
    };
  }

  const mixInputs = mixLabels.map((l) => `[${l}]`).join("");
  return {
    inputs: audioInputs,
    filter: `${filterParts.join(";")};${mixInputs}amix=inputs=${mixLabels.length}:normalize=0${postFilters}[aout]`,
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
    loopAudio,
    keepSourceAudio,
    clipsAudioVolume,
    outputVolume,
    audioNorm,
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

  const continuousVideoOverlays = collectContinuousVideoOverlays(clips);
  const imageOverlays = collectImageOverlays(clips);
  const overlayInputs: string[] = [];
  const videoOverlayInputMap = new Map<string, number>();
  const imageOverlayInputMap = new Map<string, number>();

  for (const [path] of continuousVideoOverlays) {
    videoOverlayInputMap.set(path, overlayInputs.length);
    overlayInputs.push(path);
  }

  for (const [path] of imageOverlays) {
    imageOverlayInputMap.set(path, overlayInputs.length);
    overlayInputs.push(path);
  }

  const allFilters: string[] = [];
  const allInputs: string[] = [...overlayInputs];
  const clipOutputLabels: string[] = [];
  const videoSourceAudio: VideoSourceAudio[] = [];
  let inputOffset = overlayInputs.length;
  let currentClipTime = 0;

  for (const [i, clip] of clips.entries()) {
    const result = buildBaseClipFilter(clip, i, width, height, inputOffset);

    allFilters.push(...result.filters);
    allInputs.push(...result.inputs);
    clipOutputLabels.push(result.outputLabel);

    for (const { inputIndex, cutFrom, mixVolume } of result.videoSources) {
      const prevClip = i > 0 ? clips[i - 1] : null;
      const fadeInDuration = prevClip ? prevClip.transition.duration : 0;
      const fadeInCurve = prevClip?.transition.audioInCurve ?? "tri";
      const fadeOutDuration = clip.transition.duration;
      const fadeOutCurve = clip.transition.audioOutCurve ?? "tri";

      videoSourceAudio.push({
        inputIndex,
        startTime: currentClipTime,
        duration: clip.duration,
        cutFrom,
        mixVolume,
        fadeInDuration: fadeInDuration > 0 ? fadeInDuration : undefined,
        fadeInCurve,
        fadeOutDuration: fadeOutDuration > 0 ? fadeOutDuration : undefined,
        fadeOutCurve,
      });
    }

    inputOffset = result.nextInputOffset;
    currentClipTime += clip.duration;
    if (i < clips.length - 1) {
      currentClipTime -= clip.transition.duration;
    }
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

  if (continuousVideoOverlays.size > 0) {
    let currentBase = finalVideoLabel;
    let overlayIdx = 0;

    for (const [path, { layer }] of continuousVideoOverlays) {
      const inputIndex = videoOverlayInputMap.get(path);
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

  if (imageOverlays.size > 0) {
    let currentBase = finalVideoLabel;
    let imgOverlayIdx = 0;

    for (const [path, { layer }] of imageOverlays) {
      const inputIndex = imageOverlayInputMap.get(path);
      if (inputIndex === undefined) continue;

      const imgFilter = getImageOverlayFilter(
        layer,
        inputIndex,
        width,
        height,
        totalDuration,
      );
      allFilters.push(imgFilter.filterComplex);

      const outputLabel = `vwithimgov${imgOverlayIdx}`;
      const positionFilter = getImageOverlayPositionFilter(
        currentBase,
        imgFilter.outputLabel,
        layer,
        width,
        height,
        outputLabel,
      );
      allFilters.push(positionFilter);

      currentBase = outputLabel;
      imgOverlayIdx++;
    }

    finalVideoLabel = currentBase;
  }

  const textLayers = collectTextLayers(clips);
  if (textLayers.length > 0) {
    let currentBase = finalVideoLabel;

    for (let i = 0; i < textLayers.length; i++) {
      const timedLayer = textLayers[i];
      if (!timedLayer) continue;

      const { layer, startTime, duration } = timedLayer;
      const outputLabel = `vwithtext${i}`;

      const timedLayerWithEnable = {
        ...layer,
        start: layer.start ?? startTime,
        stop: layer.stop ?? startTime + duration,
      };

      if (layer.type === "title") {
        const titleFilter = getTitleFilter(
          timedLayerWithEnable as TitleLayer,
          currentBase,
          width,
          height,
          totalDuration,
        );
        allFilters.push(`${titleFilter}[${outputLabel}]`);
      } else if (layer.type === "subtitle") {
        const subtitleFilter = getSubtitleFilter(
          timedLayerWithEnable as SubtitleLayer,
          currentBase,
          width,
          height,
          totalDuration,
        );
        allFilters.push(`${subtitleFilter}[${outputLabel}]`);
      } else if (layer.type === "news-title") {
        const newsFilter = getNewsTitleFilter(
          timedLayerWithEnable as NewsTitleLayer,
          currentBase,
          width,
          height,
          totalDuration,
        );
        allFilters.push(`${newsFilter}[${outputLabel}]`);
      } else if (layer.type === "slide-in-text") {
        const slideFilter = getSlideInTextFilter(
          timedLayerWithEnable as SlideInTextLayer,
          currentBase,
          width,
          height,
          totalDuration,
        );
        allFilters.push(`${slideFilter}[${outputLabel}]`);
      }

      currentBase = outputLabel;
    }

    finalVideoLabel = currentBase;
  }

  const clipAudioLayers = collectAudioLayers(clips);
  const videoInputCount = allInputs.length;
  const audioFilter = buildAudioFilter(
    videoInputCount,
    audioTracks,
    clipAudioLayers,
    totalDuration,
    audioFilePath,
    loopAudio,
    keepSourceAudio,
    outputVolume,
    videoSourceAudio,
    clipsAudioVolume,
    audioNorm,
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
