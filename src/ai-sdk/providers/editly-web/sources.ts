/**
 * Source loaders for editly-web
 * Handles video decoding via VideoDecoder and image loading via ImageBitmap
 */

import type { Movie, MP4BoxBuffer, Sample, Track } from "mp4box";
import * as MP4Box from "mp4box";

export interface FrameSource {
  type: "video" | "image";
  width: number;
  height: number;
  duration: number;
  getFrame(timeSeconds: number): Promise<VideoFrame | ImageBitmap>;
  close(): void;
}

export interface VideoSourceOptions {
  data: ArrayBuffer;
}

export interface ImageSourceOptions {
  data: ArrayBuffer | Blob;
  duration: number;
}

export class VideoSource implements FrameSource {
  type: "video" = "video";
  width = 0;
  height = 0;
  duration = 0;
  fps = 30;

  private decoder: VideoDecoder | null = null;
  private samples: Sample[] = [];
  private codecConfig: VideoDecoderConfig | null = null;
  private pendingFrame: VideoFrame | null = null;
  private frameResolve: ((frame: VideoFrame) => void) | null = null;
  private initialized = false;

  static async create(options: VideoSourceOptions): Promise<VideoSource> {
    const source = new VideoSource();
    await source.init(options.data);
    return source;
  }

  private async init(data: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const mp4box = MP4Box.createFile();

      mp4box.onReady = (info: Movie) => {
        const videoTrack = info.tracks.find((t: Track) => t.type === "video");
        if (!videoTrack) {
          reject(new Error("No video track found"));
          return;
        }

        this.width = videoTrack.video?.width ?? videoTrack.track_width ?? 0;
        this.height = videoTrack.video?.height ?? videoTrack.track_height ?? 0;
        this.duration = info.duration / info.timescale;
        this.fps =
          videoTrack.nb_samples / (videoTrack.duration / videoTrack.timescale);

        const codec = videoTrack.codec;
        this.codecConfig = {
          codec,
          codedWidth: this.width,
          codedHeight: this.height,
        };

        mp4box.setExtractionOptions(videoTrack.id, null, {
          nbSamples: videoTrack.nb_samples,
        });
        mp4box.start();
      };

      mp4box.onSamples = (
        _trackId: number,
        _user: unknown,
        samples: Sample[],
      ) => {
        this.samples.push(...samples);
      };

      mp4box.onError = (_module: string, message: string) =>
        reject(new Error(message));

      const buffer = data as unknown as MP4BoxBuffer;
      buffer.fileStart = 0;
      mp4box.appendBuffer(buffer);
      mp4box.flush();

      this.decoder = new VideoDecoder({
        output: (frame) => {
          if (this.frameResolve) {
            this.frameResolve(frame);
            this.frameResolve = null;
          } else {
            this.pendingFrame?.close();
            this.pendingFrame = frame;
          }
        },
        error: (e) => console.error("VideoDecoder error:", e),
      });

      setTimeout(() => {
        if (this.codecConfig) {
          this.decoder!.configure(this.codecConfig);
          this.initialized = true;
          resolve();
        } else {
          reject(new Error("Failed to get codec config"));
        }
      }, 10);
    });
  }

  async getFrame(timeSeconds: number): Promise<VideoFrame> {
    if (!this.initialized || !this.decoder) {
      throw new Error("VideoSource not initialized");
    }

    const targetTime = timeSeconds * 1_000_000;
    let closestSample: Sample | null = null;
    let closestDiff = Infinity;

    for (const sample of this.samples) {
      const sampleTime = (sample.cts / sample.timescale) * 1_000_000;
      const diff = Math.abs(sampleTime - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestSample = sample;
      }
    }

    if (!closestSample || !closestSample.data) {
      throw new Error(`No sample found for time ${timeSeconds}`);
    }

    const chunk = new EncodedVideoChunk({
      type: closestSample.is_sync ? "key" : "delta",
      timestamp: (closestSample.cts / closestSample.timescale) * 1_000_000,
      duration: (closestSample.duration / closestSample.timescale) * 1_000_000,
      data: closestSample.data,
    });

    return new Promise<VideoFrame>((resolve) => {
      this.frameResolve = resolve;
      this.decoder!.decode(chunk);
    });
  }

  close(): void {
    this.pendingFrame?.close();
    this.pendingFrame = null;
    this.decoder?.close();
    this.decoder = null;
    this.samples = [];
  }
}

/**
 * Image source that returns the same ImageBitmap for any requested time
 */
export class ImageSource implements FrameSource {
  type: "image" = "image";
  width = 0;
  height = 0;
  duration: number;

  private bitmap: ImageBitmap | null = null;

  constructor(duration: number) {
    this.duration = duration;
  }

  static async create(options: ImageSourceOptions): Promise<ImageSource> {
    const source = new ImageSource(options.duration);
    await source.init(options.data);
    return source;
  }

  private async init(data: ArrayBuffer | Blob): Promise<void> {
    const blob = data instanceof Blob ? data : new Blob([data]);
    this.bitmap = await createImageBitmap(blob);
    this.width = this.bitmap.width;
    this.height = this.bitmap.height;
  }

  async getFrame(_timeSeconds: number): Promise<ImageBitmap> {
    if (!this.bitmap) {
      throw new Error("ImageSource not initialized");
    }
    // Return a copy since VideoFrame/ImageBitmap can be closed after use
    return createImageBitmap(this.bitmap);
  }

  close(): void {
    this.bitmap?.close();
    this.bitmap = null;
  }
}

/**
 * Solid color source - generates frames of a solid color
 */
export class ColorSource implements FrameSource {
  type: "image" = "image";
  width: number;
  height: number;
  duration: number;

  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor(
    width: number,
    height: number,
    duration: number,
    color: string = "#000000",
  ) {
    this.width = width;
    this.height = height;
    this.duration = duration;

    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, width, height);
  }

  async getFrame(_timeSeconds: number): Promise<ImageBitmap> {
    return createImageBitmap(this.canvas);
  }

  close(): void {
    // Nothing to clean up
  }
}

/**
 * Gradient source - generates gradient frames
 */
export class GradientSource implements FrameSource {
  type: "image" = "image";
  width: number;
  height: number;
  duration: number;

  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor(
    width: number,
    height: number,
    duration: number,
    colors: [string, string],
    gradientType: "linear" | "radial" = "linear",
  ) {
    this.width = width;
    this.height = height;
    this.duration = duration;

    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext("2d")!;

    let gradient: CanvasGradient;
    if (gradientType === "radial") {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.max(width, height) / 2;
      gradient = this.ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius,
      );
    } else {
      gradient = this.ctx.createLinearGradient(0, 0, width, height);
    }

    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  async getFrame(_timeSeconds: number): Promise<ImageBitmap> {
    return createImageBitmap(this.canvas);
  }

  close(): void {}
}
