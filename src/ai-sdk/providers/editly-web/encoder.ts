export interface EncoderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
}

export class VideoEncoderWrapper {
  private encoder: VideoEncoder | null = null;
  private chunks: EncodedVideoChunk[] = [];
  private config: EncoderConfig;
  private frameCount = 0;
  private flushResolve: (() => void) | null = null;

  constructor(config: EncoderConfig) {
    this.config = config;
  }

  async configure(): Promise<void> {
    const { width, height, fps, bitrate = 5_000_000 } = this.config;

    this.encoder = new VideoEncoder({
      output: (chunk) => {
        this.chunks.push(chunk);
      },
      error: (e) => {
        throw new Error(`VideoEncoder error: ${e.message}`);
      },
    });

    const codecConfig: VideoEncoderConfig = {
      codec: "avc1.640028", // H.264 High Profile Level 4.0
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: "prefer-hardware",
      avc: { format: "annexb" },
    };

    const support = await VideoEncoder.isConfigSupported(codecConfig);
    if (!support.supported) {
      codecConfig.hardwareAcceleration = "prefer-software";
      const softwareSupport = await VideoEncoder.isConfigSupported(codecConfig);
      if (!softwareSupport.supported) {
        throw new Error("H.264 encoding not supported");
      }
    }

    this.encoder.configure(codecConfig);
  }

  encode(frame: VideoFrame): void {
    if (!this.encoder) {
      throw new Error("Encoder not configured");
    }

    const timestamp = (this.frameCount / this.config.fps) * 1_000_000;
    const frameWithTimestamp = new VideoFrame(frame, { timestamp });

    const keyFrame = this.frameCount % 30 === 0;
    this.encoder.encode(frameWithTimestamp, { keyFrame });

    frameWithTimestamp.close();
    this.frameCount++;
  }

  async flush(): Promise<EncodedVideoChunk[]> {
    if (!this.encoder) {
      throw new Error("Encoder not configured");
    }

    await this.encoder.flush();
    return this.chunks;
  }

  getChunks(): EncodedVideoChunk[] {
    return this.chunks;
  }

  close(): void {
    this.encoder?.close();
    this.encoder = null;
    this.chunks = [];
    this.frameCount = 0;
  }
}
