export interface AudioEncoderConfig {
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
}

export class AudioEncoderWrapper {
  private encoder: AudioEncoder | null = null;
  private chunks: EncodedAudioChunk[] = [];
  private sampleRate: number;
  private numberOfChannels: number;
  private bitrate: number;
  private configured = false;
  private frameCounter = 0;

  constructor(config: AudioEncoderConfig) {
    this.sampleRate = config.sampleRate;
    this.numberOfChannels = config.numberOfChannels;
    this.bitrate = config.bitrate ?? 128000;
  }

  async configure(): Promise<void> {
    this.encoder = new AudioEncoder({
      output: (chunk) => {
        this.chunks.push(chunk);
      },
      error: (e) => console.error("AudioEncoder error:", e),
    });

    const config: AudioEncoderConfig & { codec: string } = {
      codec: "mp4a.40.2",
      sampleRate: this.sampleRate,
      numberOfChannels: this.numberOfChannels,
      bitrate: this.bitrate,
    };

    const support = await AudioEncoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error(`Audio codec not supported: ${config.codec}`);
    }

    this.encoder.configure(config);
    this.configured = true;
  }

  encode(samples: Float32Array[]): void {
    if (!this.encoder || !this.configured) {
      throw new Error("AudioEncoder not configured");
    }

    const numberOfFrames = samples[0]?.length ?? 0;
    if (numberOfFrames === 0) return;

    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: this.sampleRate,
      numberOfFrames,
      numberOfChannels: this.numberOfChannels,
      timestamp:
        this.frameCounter * (1_000_000 / this.sampleRate) * numberOfFrames,
      data: this.interleaveSamples(samples),
    });

    this.frameCounter++;
    this.encoder.encode(audioData);
    audioData.close();
  }

  private interleaveSamples(samples: Float32Array[]): ArrayBuffer {
    const numFrames = samples[0]?.length ?? 0;
    const numChannels = samples.length;
    const interleaved = new Float32Array(numFrames * numChannels);

    for (let ch = 0; ch < numChannels; ch++) {
      const channel = samples[ch]!;
      for (let i = 0; i < numFrames; i++) {
        interleaved[ch * numFrames + i] = channel[i]!;
      }
    }

    return interleaved.buffer as ArrayBuffer;
  }

  async flush(): Promise<EncodedAudioChunk[]> {
    if (!this.encoder) {
      return [];
    }

    await this.encoder.flush();
    return this.chunks;
  }

  close(): void {
    this.encoder?.close();
    this.encoder = null;
    this.chunks = [];
    this.configured = false;
  }

  getChunks(): EncodedAudioChunk[] {
    return this.chunks;
  }
}
