import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export interface MuxerConfig {
  width: number;
  height: number;
  fps: number;
}

export function muxToMp4(
  videoChunks: EncodedVideoChunk[],
  config: MuxerConfig,
): Uint8Array {
  const { width, height, fps } = config;

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

  for (const chunk of videoChunks) {
    muxer.addVideoChunk(chunk);
  }

  muxer.finalize();

  return new Uint8Array(target.buffer);
}

export function muxVideoAndAudio(
  videoChunks: EncodedVideoChunk[],
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

  for (const chunk of videoChunks) {
    muxer.addVideoChunk(chunk);
  }

  for (const chunk of audioChunks) {
    muxer.addAudioChunk(chunk);
  }

  muxer.finalize();

  return new Uint8Array(target.buffer);
}
