import type {
  AudioLayer,
  AudioTrack,
  Clip,
  DetachedAudioLayer,
  EditlyConfig,
  FillColorLayer,
  ImageLayer,
  Layer,
  LinearGradientLayer,
  ProcessedClip,
  RadialGradientLayer,
  VideoLayer,
} from "../editly/types.ts";
import { AudioSource } from "./audio-decoder.ts";
import { AudioEncoderWrapper } from "./audio-encoder.ts";
import { AudioMixer, type AudioTrackState } from "./audio-mixer.ts";
import { WebGLCompositor } from "./compositor.ts";
import { VideoEncoderWrapper } from "./encoder.ts";
import { muxToMp4, muxVideoAndAudio } from "./muxer.ts";
import {
  ColorSource,
  type FrameSource,
  GradientSource,
  ImageSource,
  VideoSource,
} from "./sources.ts";

export type { EditlyConfig } from "../editly/types.ts";

export interface EditlyWebConfig extends Omit<EditlyConfig, "outPath"> {
  sources: Map<string, ArrayBuffer | Blob>;
}

const DEFAULT_DURATION = 4;
const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_CHANNELS = 2;

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
  sources: Map<string, ArrayBuffer | Blob>,
): Promise<ProcessedClip[]> {
  const processed: ProcessedClip[] = [];
  const defaultDuration = defaults?.duration ?? DEFAULT_DURATION;

  for (const clip of clips) {
    const layers = clip.layers.map((layer) =>
      applyLayerDefaults(layer, defaults),
    );
    let duration = clip.duration ?? defaultDuration;

    for (const layer of layers) {
      if (layer.type === "video" && !clip.duration) {
        const videoLayer = layer as VideoLayer;
        const data = sources.get(videoLayer.path);
        if (data) {
          const source = await VideoSource.create({
            data: data instanceof Blob ? await data.arrayBuffer() : data,
          });
          const cutFrom = videoLayer.cutFrom ?? 0;
          const cutTo = videoLayer.cutTo ?? source.duration;
          duration = cutTo - cutFrom;
          source.close();
        }
        break;
      }
    }

    processed.push({
      layers,
      duration,
      transition: {
        name: clip.transition?.name ?? "fade",
        duration: clip.transition?.duration ?? 0,
        audioOutCurve: clip.transition?.audioOutCurve ?? "tri",
        audioInCurve: clip.transition?.audioInCurve ?? "tri",
      },
    });
  }

  return processed;
}

async function createSource(
  layer: Layer,
  sources: Map<string, ArrayBuffer | Blob>,
  duration: number,
  width: number,
  height: number,
): Promise<FrameSource | null> {
  switch (layer.type) {
    case "video": {
      const videoLayer = layer as VideoLayer;
      const data = sources.get(videoLayer.path);
      if (!data) throw new Error(`Video source not found: ${videoLayer.path}`);
      return VideoSource.create({
        data: data instanceof Blob ? await data.arrayBuffer() : data,
      });
    }

    case "image": {
      const imageLayer = layer as ImageLayer;
      const data = sources.get(imageLayer.path);
      if (!data) throw new Error(`Image source not found: ${imageLayer.path}`);
      return ImageSource.create({
        data,
        duration: imageLayer.duration ?? duration,
      });
    }

    case "fill-color": {
      const fillLayer = layer as FillColorLayer;
      return new ColorSource(width, height, duration, fillLayer.color);
    }

    case "linear-gradient": {
      const gradientLayer = layer as LinearGradientLayer;
      return new GradientSource(
        width,
        height,
        duration,
        gradientLayer.colors ?? ["#000000", "#ffffff"],
        "linear",
      );
    }

    case "radial-gradient": {
      const gradientLayer = layer as RadialGradientLayer;
      return new GradientSource(
        width,
        height,
        duration,
        gradientLayer.colors ?? ["#000000", "#ffffff"],
        "radial",
      );
    }

    default:
      return null;
  }
}

interface AudioProcessingResult {
  hasAudio: boolean;
  chunks: EncodedAudioChunk[];
  sampleRate: number;
  numberOfChannels: number;
}

async function processAudio(
  clips: ProcessedClip[],
  config: EditlyWebConfig,
): Promise<AudioProcessingResult> {
  const sources = config.sources;
  const keepSourceAudio = config.keepSourceAudio ?? false;
  const clipsAudioVolume = parseVolume(config.clipsAudioVolume ?? 1);
  const loopAudio = config.loopAudio ?? false;

  let totalDuration = 0;
  for (const clip of clips) {
    totalDuration += clip.duration;
  }

  const mixer = new AudioMixer({
    sampleRate: DEFAULT_SAMPLE_RATE,
    numberOfChannels: DEFAULT_CHANNELS,
    totalDuration,
  });

  let hasAnyAudio = false;
  let currentTime = 0;

  for (const clip of clips) {
    for (const layer of clip.layers) {
      if (layer.type === "video" && keepSourceAudio) {
        const videoLayer = layer as VideoLayer;
        const data = sources.get(videoLayer.path);
        if (data) {
          const audioSource = await AudioSource.create({
            data: data instanceof Blob ? await data.arrayBuffer() : data,
          });
          if (audioSource.hasAudio()) {
            hasAnyAudio = true;
            const cutFrom = videoLayer.cutFrom ?? 0;
            const samples = audioSource.getSamples(cutFrom, clip.duration);
            const volume =
              parseVolume(videoLayer.mixVolume ?? 1) * clipsAudioVolume;
            mixer.addTrack({
              samples,
              startTime: currentTime,
              duration: clip.duration,
              volume,
            });
          }
          audioSource.close();
        }
      }

      if (layer.type === "audio") {
        const audioLayer = layer as AudioLayer;
        const data = sources.get(audioLayer.path);
        if (data) {
          const audioSource = await AudioSource.create({
            data: data instanceof Blob ? await data.arrayBuffer() : data,
          });
          if (audioSource.hasAudio()) {
            hasAnyAudio = true;
            const cutFrom = audioLayer.cutFrom ?? 0;
            const cutTo = audioLayer.cutTo ?? audioSource.duration;
            const samples = audioSource.getSamples(cutFrom, cutTo - cutFrom);
            const startOffset = audioLayer.start ?? 0;
            mixer.addTrack({
              samples,
              startTime: currentTime + startOffset,
              duration: cutTo - cutFrom,
              volume: parseVolume(audioLayer.mixVolume ?? 1),
            });
          }
          audioSource.close();
        }
      }

      if (layer.type === "detached-audio") {
        const detachedLayer = layer as DetachedAudioLayer;
        const data = sources.get(detachedLayer.path);
        if (data) {
          const audioSource = await AudioSource.create({
            data: data instanceof Blob ? await data.arrayBuffer() : data,
          });
          if (audioSource.hasAudio()) {
            hasAnyAudio = true;
            const cutFrom = detachedLayer.cutFrom ?? 0;
            const cutTo = detachedLayer.cutTo ?? audioSource.duration;
            const startOffset = detachedLayer.start ?? 0;
            const samples = audioSource.getSamples(cutFrom, cutTo - cutFrom);
            mixer.addTrack({
              samples,
              startTime: currentTime + startOffset,
              duration: cutTo - cutFrom,
              volume: parseVolume(detachedLayer.mixVolume ?? 1),
            });
          }
          audioSource.close();
        }
      }
    }
    currentTime += clip.duration;
  }

  if (config.audioTracks) {
    for (const track of config.audioTracks) {
      await addAudioTrack(mixer, track, sources, totalDuration, loopAudio);
      hasAnyAudio = true;
    }
  }

  if (config.audioFilePath) {
    const data = sources.get(config.audioFilePath);
    if (data) {
      const backgroundTrack: AudioTrack = {
        path: config.audioFilePath,
        mixVolume: config.backgroundAudioVolume ?? 1,
      };
      await addAudioTrack(
        mixer,
        backgroundTrack,
        sources,
        totalDuration,
        loopAudio,
      );
      hasAnyAudio = true;
    }
  }

  if (!hasAnyAudio) {
    return {
      hasAudio: false,
      chunks: [],
      sampleRate: DEFAULT_SAMPLE_RATE,
      numberOfChannels: DEFAULT_CHANNELS,
    };
  }

  let mixedSamples = mixer.mix();

  if (config.audioNorm?.enable) {
    mixedSamples = AudioMixer.normalize(mixedSamples);
  }

  if (config.outputVolume !== undefined) {
    mixedSamples = AudioMixer.applyVolume(mixedSamples, config.outputVolume);
  }

  const audioEncoder = new AudioEncoderWrapper({
    sampleRate: DEFAULT_SAMPLE_RATE,
    numberOfChannels: DEFAULT_CHANNELS,
  });
  await audioEncoder.configure();

  const chunkSize = 1024;
  const totalSamples = mixedSamples[0].length;
  for (let i = 0; i < totalSamples; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalSamples);
    const chunk: Float32Array[] = mixedSamples.map((ch) => ch.slice(i, end));
    audioEncoder.encode(chunk);
  }

  const chunks = await audioEncoder.flush();
  audioEncoder.close();

  return {
    hasAudio: true,
    chunks,
    sampleRate: DEFAULT_SAMPLE_RATE,
    numberOfChannels: DEFAULT_CHANNELS,
  };
}

async function addAudioTrack(
  mixer: AudioMixer,
  track: AudioTrack,
  sources: Map<string, ArrayBuffer | Blob>,
  totalDuration: number,
  loop: boolean,
): Promise<void> {
  const data = sources.get(track.path);
  if (!data) return;

  const audioSource = await AudioSource.create({
    data: data instanceof Blob ? await data.arrayBuffer() : data,
  });

  if (!audioSource.hasAudio()) {
    audioSource.close();
    return;
  }

  const cutFrom = track.cutFrom ?? 0;
  const cutTo = track.cutTo ?? audioSource.duration;
  const startOffset = track.start ?? 0;
  const trackDuration = cutTo - cutFrom;

  if (loop) {
    let currentStart = startOffset;
    while (currentStart < totalDuration) {
      const remainingDuration = totalDuration - currentStart;
      const segmentDuration = Math.min(trackDuration, remainingDuration);
      const samples = audioSource.getSamples(cutFrom, segmentDuration);
      mixer.addTrack({
        samples,
        startTime: currentStart,
        duration: segmentDuration,
        volume: parseVolume(track.mixVolume ?? 1),
      });
      currentStart += trackDuration;
    }
  } else {
    const samples = audioSource.getSamples(cutFrom, trackDuration);
    mixer.addTrack({
      samples,
      startTime: startOffset,
      duration: trackDuration,
      volume: parseVolume(track.mixVolume ?? 1),
    });
  }

  audioSource.close();
}

function parseVolume(vol: number | string): number {
  if (typeof vol === "number") return vol;
  const parsed = parseFloat(vol);
  return isNaN(parsed) ? 1 : parsed;
}

export async function editlyWeb(config: EditlyWebConfig): Promise<Uint8Array> {
  const { clips: clipsIn, defaults, sources } = config;

  if (!clipsIn || clipsIn.length === 0) {
    throw new Error("At least one clip is required");
  }

  const width = config.width ?? DEFAULT_WIDTH;
  const height = config.height ?? DEFAULT_HEIGHT;
  const fps = config.fps ?? DEFAULT_FPS;

  const clips = await processClips(clipsIn, defaults, sources);

  const compositor = new WebGLCompositor(width, height);
  const encoder = new VideoEncoderWrapper({ width, height, fps });
  await encoder.configure();

  const frameDuration = 1 / fps;

  for (const clip of clips) {
    const clipSources: FrameSource[] = [];

    for (const layer of clip.layers) {
      const source = await createSource(
        layer,
        sources,
        clip.duration,
        width,
        height,
      );
      if (source) {
        clipSources.push(source);
      }
    }

    const frameCount = Math.ceil(clip.duration * fps);

    for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
      const time = frameIdx * frameDuration;

      compositor.clear("#000000");

      for (let i = 0; i < clipSources.length; i++) {
        const source = clipSources[i];
        const layer = clip.layers[i];
        if (!source || !layer) continue;

        const frame = await source.getFrame(time);

        if (
          layer.type === "linear-gradient" ||
          layer.type === "radial-gradient"
        ) {
          const gradientLayer = layer as
            | LinearGradientLayer
            | RadialGradientLayer;
          const gradientType =
            layer.type === "radial-gradient" ? "radial" : "linear";
          compositor.drawGradient(
            gradientType,
            gradientLayer.colors ?? ["#000000", "#ffffff"],
          );
        } else {
          const resizeMode =
            layer.type === "video"
              ? (layer as VideoLayer).resizeMode
              : layer.type === "image"
                ? (layer as ImageLayer).resizeMode
                : undefined;

          compositor.drawFrame(frame, { resizeMode });
        }

        if (frame instanceof VideoFrame) {
          frame.close();
        }
      }

      const outputFrame = compositor.getFrame();
      encoder.encode(outputFrame);
      outputFrame.close();
    }

    for (const source of clipSources) {
      source.close();
    }
  }

  const videoChunks = await encoder.flush();
  encoder.close();
  compositor.destroy();

  const audioResult = await processAudio(clips, config);

  if (audioResult.hasAudio) {
    return muxVideoAndAudio(videoChunks, audioResult.chunks, {
      width,
      height,
      fps,
      sampleRate: audioResult.sampleRate,
      numberOfChannels: audioResult.numberOfChannels,
    });
  }

  return muxToMp4(videoChunks, { width, height, fps });
}

export default editlyWeb;
