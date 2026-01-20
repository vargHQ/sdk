import type {
  Clip,
  EditlyConfig,
  FillColorLayer,
  ImageLayer,
  Layer,
  LinearGradientLayer,
  ProcessedClip,
  RadialGradientLayer,
  VideoLayer,
} from "../editly/types.ts";
import { WebGLCompositor } from "./compositor.ts";
import { VideoEncoderWrapper } from "./encoder.ts";
import { muxToMp4 } from "./muxer.ts";
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

  const chunks = await encoder.flush();
  encoder.close();
  compositor.destroy();

  return muxToMp4(chunks, { width, height, fps });
}

export default editlyWeb;
