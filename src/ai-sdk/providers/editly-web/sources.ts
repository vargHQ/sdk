import type {
  Movie,
  MP4BoxBuffer,
  Sample,
  Track,
  VisualSampleEntry,
} from "mp4box";
import * as MP4Box from "mp4box";

console.log("[sources.ts] MP4Box module loaded");

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
    console.log(`[VideoSource] init() called, data size: ${data.byteLength}`);

    return new Promise((resolve, reject) => {
      const mp4box = MP4Box.createFile(true);

      mp4box.onError = (e: string) => {
        console.error(`[VideoSource] mp4box error:`, e);
        reject(new Error(e));
      };

      mp4box.onReady = async (info: Movie) => {
        console.log(`[VideoSource] onReady, tracks: ${info.tracks.length}`);

        const videoTrack = info.tracks.find((t: Track) => t.type === "video");
        if (!videoTrack) {
          reject(new Error("No video track found"));
          return;
        }

        console.log(
          `[VideoSource] Video track: ${videoTrack.codec}, ${videoTrack.nb_samples} samples`,
        );

        this.width = videoTrack.video?.width ?? videoTrack.track_width ?? 0;
        this.height = videoTrack.video?.height ?? videoTrack.track_height ?? 0;
        this.duration = info.duration / info.timescale;
        this.fps =
          videoTrack.nb_samples / (videoTrack.duration / videoTrack.timescale);

        let description: Uint8Array | undefined;
        const trak = mp4box.getTrackById(videoTrack.id);
        if (trak) {
          for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            const visualEntry = entry as VisualSampleEntry;
            if (visualEntry.avcC) {
              const stream = new MP4Box.DataStream(
                undefined,
                0,
                MP4Box.Endianness.BIG_ENDIAN,
              );
              visualEntry.avcC.write(stream as MP4Box.MultiBufferStream);
              description = new Uint8Array(stream.buffer.slice(8));
              console.log(
                `[VideoSource] Got avcC description, ${description.length} bytes, first bytes:`,
                Array.from(description.slice(0, 10)),
              );
              break;
            }
          }
        }

        if (!description) {
          console.error(`[VideoSource] No avcC found in track`);
        }

        const config: VideoDecoderConfig = {
          codec: videoTrack.codec,
          codedWidth: this.width,
          codedHeight: this.height,
          description,
        };

        const support = await VideoDecoder.isConfigSupported(config);
        if (!support.supported) {
          console.error(`[VideoSource] Codec not supported:`, config);
          reject(
            new Error(`Unsupported codec: ${videoTrack.codec}. Use H.264.`),
          );
          return;
        }

        this.codecConfig = config;
        const expectedSamples = videoTrack.nb_samples;

        mp4box.onSamples = (
          _trackId: number,
          _user: unknown,
          samples: Sample[],
        ) => {
          console.log(
            `[VideoSource] onSamples: ${samples.length}, total: ${this.samples.length + samples.length}/${expectedSamples}`,
          );
          this.samples.push(...samples);

          if (this.samples.length >= expectedSamples) {
            console.log(
              `[VideoSource] All samples received, initializing decoder`,
            );
            this.decoder = new VideoDecoder({
              output: (frame) => {
                console.log(
                  `[VideoDecoder] Output frame: ${frame.codedWidth}x${frame.codedHeight}, ts=${frame.timestamp}`,
                );
                if (this.frameResolve) {
                  this.frameResolve(frame);
                  this.frameResolve = null;
                } else {
                  this.pendingFrame?.close();
                  this.pendingFrame = frame;
                }
              },
              error: (e) => {
                console.error(`[VideoDecoder] Error:`, e);
              },
            });

            this.decoder.configure(this.codecConfig!);
            this.initialized = true;
            resolve();
          }
        };

        mp4box.setExtractionOptions(videoTrack.id, null, {
          nbSamples: expectedSamples,
        });

        console.log(`[VideoSource] Starting sample extraction, seeking to 0`);
        mp4box.seek(0, true);
        mp4box.start();
      };

      const buffer = data.slice(0) as unknown as MP4BoxBuffer;
      buffer.fileStart = 0;
      mp4box.appendBuffer(buffer);
      mp4box.flush();
    });
  }

  private lastDecodedIndex = -1;

  async getFrame(timeSeconds: number): Promise<VideoFrame> {
    if (!this.initialized || !this.decoder) {
      throw new Error("VideoSource not initialized");
    }

    const targetTime = timeSeconds * 1_000_000;
    let targetIndex = 0;
    let closestDiff = Infinity;

    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i]!;
      const sampleTime = (sample.cts / sample.timescale) * 1_000_000;
      const diff = Math.abs(sampleTime - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        targetIndex = i;
      }
    }

    let startIndex = this.lastDecodedIndex + 1;

    if (targetIndex < this.lastDecodedIndex || this.lastDecodedIndex === -1) {
      for (let i = targetIndex; i >= 0; i--) {
        if (this.samples[i]!.is_sync) {
          startIndex = i;
          break;
        }
      }
    }

    console.log(
      `[VideoSource] getFrame: startIndex=${startIndex}, targetIndex=${targetIndex}, lastDecoded=${this.lastDecodedIndex}`,
    );

    for (let i = startIndex; i <= targetIndex; i++) {
      const sample = this.samples[i]!;
      if (!sample.data) {
        console.log(`[VideoSource] Sample ${i} has no data, skipping`);
        continue;
      }

      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? "key" : "delta",
        timestamp: (sample.cts / sample.timescale) * 1_000_000,
        duration: (sample.duration / sample.timescale) * 1_000_000,
        data: sample.data,
      });

      console.log(
        `[VideoSource] Decoding sample ${i}, sync=${sample.is_sync}, size=${sample.data.byteLength}`,
      );

      if (i === targetIndex) {
        return new Promise<VideoFrame>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error(
              `[VideoSource] Timeout! Decoder state: ${this.decoder?.state}, queue: ${this.decoder?.decodeQueueSize}`,
            );
            reject(new Error(`Decode timeout at ${timeSeconds}s (index ${i})`));
          }, 5000);

          this.frameResolve = (frame) => {
            clearTimeout(timeout);
            this.lastDecodedIndex = i;
            resolve(frame);
          };

          this.decoder!.decode(chunk);
        });
      } else {
        this.decoder!.decode(chunk);
        this.lastDecodedIndex = i;
      }
    }

    throw new Error(`Failed to decode frame at ${timeSeconds}s`);
  }

  close(): void {
    this.pendingFrame?.close();
    this.pendingFrame = null;
    this.decoder?.close();
    this.decoder = null;
    this.samples = [];
  }
}

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
    return createImageBitmap(this.bitmap);
  }

  close(): void {
    this.bitmap?.close();
    this.bitmap = null;
  }
}

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

  close(): void {}
}

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
