/**
 * Audio source decoder for editly-web
 * Decodes audio from video/audio files using WebCodecs AudioDecoder + mp4box
 */

import type { Movie, MP4BoxBuffer, Sample, Track } from "mp4box";
import * as MP4Box from "mp4box";

export interface AudioSourceOptions {
  data: ArrayBuffer;
}

export interface DecodedAudio {
  samples: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
}

export class AudioSource {
  sampleRate = 44100;
  numberOfChannels = 2;
  duration = 0;

  private samples: Float32Array[] = [];
  private audioSamples: Sample[] = [];
  private decoder: AudioDecoder | null = null;
  private codecConfig: AudioDecoderConfig | null = null;
  private initialized = false;
  private decodedFrames: AudioData[] = [];

  static async create(options: AudioSourceOptions): Promise<AudioSource> {
    const source = new AudioSource();
    await source.init(options.data);
    return source;
  }

  private async init(data: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const mp4box = MP4Box.createFile();

      mp4box.onReady = (info: Movie) => {
        const audioTrack = info.tracks.find((t: Track) => t.type === "audio");
        if (!audioTrack) {
          // no audio track - resolve with empty samples
          this.initialized = true;
          resolve();
          return;
        }

        this.sampleRate = audioTrack.audio?.sample_rate ?? 44100;
        this.numberOfChannels = audioTrack.audio?.channel_count ?? 2;
        this.duration = audioTrack.duration / audioTrack.timescale;

        const codec = audioTrack.codec;
        this.codecConfig = {
          codec,
          sampleRate: this.sampleRate,
          numberOfChannels: this.numberOfChannels,
        };

        mp4box.setExtractionOptions(audioTrack.id, null, {
          nbSamples: audioTrack.nb_samples,
        });
        mp4box.start();
      };

      mp4box.onSamples = (
        _trackId: number,
        _user: unknown,
        samples: Sample[],
      ) => {
        this.audioSamples.push(...samples);
      };

      mp4box.onError = (e: string) => reject(new Error(e));

      const buffer = data as unknown as MP4BoxBuffer;
      buffer.fileStart = 0;
      mp4box.appendBuffer(buffer);
      mp4box.flush();

      setTimeout(async () => {
        if (this.codecConfig) {
          await this.decodeAllSamples();
          this.initialized = true;
          resolve();
        } else {
          // no audio codec config means no audio track
          this.initialized = true;
          resolve();
        }
      }, 10);
    });
  }

  private async decodeAllSamples(): Promise<void> {
    if (!this.codecConfig || this.audioSamples.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.decoder = new AudioDecoder({
        output: (frame) => {
          this.decodedFrames.push(frame);
        },
        error: (e) => reject(e),
      });

      this.decoder.configure(this.codecConfig!);

      for (const sample of this.audioSamples) {
        if (!sample.data) continue;

        const chunk = new EncodedAudioChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (sample.cts / sample.timescale) * 1_000_000,
          duration: (sample.duration / sample.timescale) * 1_000_000,
          data: sample.data,
        });

        this.decoder.decode(chunk);
      }

      this.decoder.flush().then(() => {
        // convert AudioData frames to Float32Array samples
        this.convertFramesToSamples();
        resolve();
      });
    });
  }

  private convertFramesToSamples(): void {
    // sort frames by timestamp
    this.decodedFrames.sort((a, b) => a.timestamp - b.timestamp);

    // initialize sample arrays for each channel
    this.samples = Array.from(
      { length: this.numberOfChannels },
      () => new Float32Array(0),
    );

    for (const frame of this.decodedFrames) {
      const frameChannels = frame.numberOfChannels;
      const frameLength = frame.numberOfFrames;

      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        const channelData = new Float32Array(frameLength);

        if (ch < frameChannels) {
          frame.copyTo(channelData, { planeIndex: ch, format: "f32-planar" });
        } else {
          // duplicate first channel if source has fewer channels
          frame.copyTo(channelData, { planeIndex: 0, format: "f32-planar" });
        }

        // append to existing samples
        const existing = this.samples[ch]!;
        const combined = new Float32Array(existing.length + frameLength);
        combined.set(existing);
        combined.set(channelData, existing.length);
        this.samples[ch] = combined;
      }

      frame.close();
    }

    this.decodedFrames = [];
  }

  /**
   * Get samples for a time range
   * @param startTime start time in seconds
   * @param duration duration in seconds
   * @returns array of Float32Array for each channel
   */
  getSamples(startTime: number, duration: number): Float32Array[] {
    if (!this.initialized || this.samples.length === 0) {
      // return silence
      const silenceLength = Math.ceil(duration * this.sampleRate);
      return Array.from(
        { length: this.numberOfChannels },
        () => new Float32Array(silenceLength),
      );
    }

    const startSample = Math.floor(startTime * this.sampleRate);
    const numSamples = Math.ceil(duration * this.sampleRate);
    const result: Float32Array[] = [];

    for (let ch = 0; ch < this.numberOfChannels; ch++) {
      const channelData = this.samples[ch]!;
      const output = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const srcIdx = startSample + i;
        if (srcIdx >= 0 && srcIdx < channelData.length) {
          output[i] = channelData[srcIdx]!;
        }
        // else remains 0 (silence)
      }

      result.push(output);
    }

    return result;
  }

  /**
   * Get all decoded samples
   */
  getAllSamples(): Float32Array[] {
    return this.samples;
  }

  hasAudio(): boolean {
    return this.samples.length > 0 && (this.samples[0]?.length ?? 0) > 0;
  }

  close(): void {
    this.decoder?.close();
    this.decoder = null;
    this.samples = [];
    this.audioSamples = [];
    for (const f of this.decodedFrames) {
      f.close();
    }
    this.decodedFrames = [];
  }
}
