import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { ChunkWithMeta } from "./encoder.ts";

export interface MuxerConfig {
  width: number;
  height: number;
  fps: number;
}

export function muxToMp4(
  videoChunks: ChunkWithMeta[],
  config: MuxerConfig,
): Uint8Array {
  const { width, height } = config;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width,
      height,
    },
    fastStart: "in-memory",
  });

  for (const { chunk, meta } of videoChunks) {
    muxer.addVideoChunk(chunk, meta);
  }

  muxer.finalize();

  return new Uint8Array(target.buffer);
}

export function muxVideoAndAudio(
  videoChunks: ChunkWithMeta[],
  audioChunks: EncodedAudioChunk[],
  config: MuxerConfig & { sampleRate: number; numberOfChannels: number },
): Uint8Array {
  const { width, height, sampleRate, numberOfChannels } = config;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width,
      height,
    },
    audio: {
      codec: "aac",
      sampleRate,
      numberOfChannels,
    },
    fastStart: "in-memory",
  });

  for (const { chunk, meta } of videoChunks) {
    muxer.addVideoChunk(chunk, meta);
  }

  for (const chunk of audioChunks) {
    muxer.addAudioChunk(chunk);
  }

  muxer.finalize();

  return new Uint8Array(target.buffer);
}
