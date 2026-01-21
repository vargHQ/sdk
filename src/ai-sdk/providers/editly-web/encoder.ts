export interface EncoderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
}

export interface ChunkWithMeta {
  chunk: EncodedVideoChunk;
  meta?: EncodedVideoChunkMetadata;
}

export class VideoEncoderWrapper {
  private encoder: VideoEncoder | null = null;
  private chunksWithMeta: ChunkWithMeta[] = [];
  private config: EncoderConfig;
  private frameCount = 0;
  private flushResolve: (() => void) | null = null;

  constructor(config: EncoderConfig) {
    this.config = config;
  }

  async configure(): Promise<void> {
    const { width, height, fps, bitrate = 5_000_000 } = this.config;

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        this.chunksWithMeta.push({ chunk, meta });
      },
      error: (e) => {
        console.error(`[VideoEncoder] Error:`, e);
        throw new Error(`VideoEncoder error: ${e.message}`);
      },
    });

    const codecConfig: VideoEncoderConfig = {
      codec: "avc1.640028",
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: "prefer-hardware",
      avc: { format: "annexb" },
    };

    const support = await VideoEncoder.isConfigSupported(codecConfig);
    if (!support.supported) {
      console.log(
        `[VideoEncoder] Hardware acceleration not supported, trying software`,
      );
      codecConfig.hardwareAcceleration = "prefer-software";
      const softwareSupport = await VideoEncoder.isConfigSupported(codecConfig);
      if (!softwareSupport.supported) {
        throw new Error("H.264 encoding not supported");
      }
    }

    console.log(
      `[VideoEncoder] Configured: ${width}x${height} @ ${fps}fps, codec: ${codecConfig.codec}`,
    );
    this.encoder.configure(codecConfig);
  }

  encode(frame: VideoFrame): void {
    if (!this.encoder) {
      throw new Error("Encoder not configured");
    }

    try {
      const timestamp = (this.frameCount / this.config.fps) * 1_000_000;
      const duration = (1 / this.config.fps) * 1_000_000;
      const frameWithTimestamp = new VideoFrame(frame, { timestamp, duration });

      const keyFrame = this.frameCount % 30 === 0;
      this.encoder.encode(frameWithTimestamp, { keyFrame });

      frameWithTimestamp.close();
      this.frameCount++;
    } catch (e) {
      console.error(
        `[VideoEncoder] Encode error at frame ${this.frameCount}:`,
        e,
      );
      throw e;
    }
  }

  async flush(): Promise<ChunkWithMeta[]> {
    if (!this.encoder) {
      throw new Error("Encoder not configured");
    }

    await this.encoder.flush();
    return this.chunksWithMeta;
  }

  getChunks(): ChunkWithMeta[] {
    return this.chunksWithMeta;
  }

  close(): void {
    this.encoder?.close();
    this.encoder = null;
    this.chunksWithMeta = [];
    this.frameCount = 0;
  }
}
