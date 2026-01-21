import type { CurveType } from "../editly/types.ts";

export interface AudioTrackState {
  samples: Float32Array[];
  startTime: number;
  duration: number;
  volume: number;
  fadeIn?: { duration: number; curve: CurveType };
  fadeOut?: { duration: number; curve: CurveType };
}

export interface MixerConfig {
  sampleRate: number;
  numberOfChannels: number;
  totalDuration: number;
}

export class AudioMixer {
  private tracks: AudioTrackState[] = [];
  private sampleRate: number;
  private numberOfChannels: number;
  private totalDuration: number;

  constructor(config: MixerConfig) {
    this.sampleRate = config.sampleRate;
    this.numberOfChannels = config.numberOfChannels;
    this.totalDuration = config.totalDuration;
  }

  addTrack(track: AudioTrackState): void {
    this.tracks.push(track);
  }

  mix(): Float32Array[] {
    const totalSamples = Math.ceil(this.totalDuration * this.sampleRate);
    const output: Float32Array[] = Array.from(
      { length: this.numberOfChannels },
      () => new Float32Array(totalSamples),
    );

    for (const track of this.tracks) {
      const startSample = Math.floor(track.startTime * this.sampleRate);

      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        const trackChannel = track.samples[ch] ?? track.samples[0];
        if (!trackChannel) continue;

        const outputChannel = output[ch];

        for (let i = 0; i < trackChannel.length; i++) {
          const outputIdx = startSample + i;
          if (outputIdx < 0 || outputIdx >= totalSamples) continue;

          let sample = trackChannel[i] * track.volume;

          const timeInTrack = i / this.sampleRate;
          sample = this.applyFades(sample, timeInTrack, track);

          outputChannel[outputIdx] += sample;
        }
      }
    }

    this.clipOutput(output);

    return output;
  }

  private applyFades(
    sample: number,
    timeInTrack: number,
    track: AudioTrackState,
  ): number {
    let result = sample;

    if (track.fadeIn && timeInTrack < track.fadeIn.duration) {
      const progress = timeInTrack / track.fadeIn.duration;
      const gain = this.getCurveValue(progress, track.fadeIn.curve);
      result *= gain;
    }

    if (track.fadeOut) {
      const fadeOutStart = track.duration - track.fadeOut.duration;
      if (timeInTrack > fadeOutStart) {
        const progress = (timeInTrack - fadeOutStart) / track.fadeOut.duration;
        const gain = 1 - this.getCurveValue(progress, track.fadeOut.curve);
        result *= gain;
      }
    }

    return result;
  }

  private getCurveValue(progress: number, curve: CurveType): number {
    const p = Math.max(0, Math.min(1, progress));

    switch (curve) {
      case "tri":
        return p;
      case "qsin":
        return Math.sin((p * Math.PI) / 2);
      case "hsin":
        return (1 - Math.cos(p * Math.PI)) / 2;
      case "esin":
        return (Math.sin((p - 0.5) * Math.PI) + 1) / 2;
      case "log":
        return Math.log10(1 + p * 9);
      case "exp":
        return (Math.exp(p * 2) - 1) / (Math.E * Math.E - 1);
      case "qua":
        return p * p;
      case "cub":
        return p * p * p;
      case "squ":
        return Math.sqrt(p);
      case "cbr":
        return Math.cbrt(p);
      case "par":
        return (1 - Math.cos(p * Math.PI)) / 2;
      case "ipar":
        return (1 + Math.cos((1 - p) * Math.PI)) / 2;
      case "iqsin":
        return 1 - Math.cos((p * Math.PI) / 2);
      case "ihsin":
        return (1 + Math.cos((1 - p) * Math.PI)) / 2;
      case "dese":
        return p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
      case "desi":
        return p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2);
      case "losi":
        return 1 / (1 + Math.exp(-12 * (p - 0.5)));
      case "nofade":
        return 1;
      default:
        return p;
    }
  }

  private clipOutput(output: Float32Array[]): void {
    for (const channel of output) {
      for (let i = 0; i < channel.length; i++) {
        channel[i] = Math.max(-1, Math.min(1, channel[i]));
      }
    }
  }

  static normalize(samples: Float32Array[], targetPeak = 0.95): Float32Array[] {
    let maxPeak = 0;
    for (const channel of samples) {
      for (const sample of channel) {
        maxPeak = Math.max(maxPeak, Math.abs(sample));
      }
    }

    if (maxPeak === 0 || maxPeak >= targetPeak) {
      return samples;
    }

    const gain = targetPeak / maxPeak;
    return samples.map((channel) => {
      const normalized = new Float32Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        normalized[i] = channel[i] * gain;
      }
      return normalized;
    });
  }

  static applyVolume(
    samples: Float32Array[],
    volume: number | string,
  ): Float32Array[] {
    const vol = typeof volume === "string" ? parseFloat(volume) : volume;
    return samples.map((channel) => {
      const adjusted = new Float32Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        adjusted[i] = channel[i] * vol;
      }
      return adjusted;
    });
  }

  static createSilence(
    duration: number,
    sampleRate: number,
    channels: number,
  ): Float32Array[] {
    const numSamples = Math.ceil(duration * sampleRate);
    return Array.from({ length: channels }, () => new Float32Array(numSamples));
  }
}
