declare module "mp4box" {
  export interface Track {
    id: number;
    type: "video" | "audio" | "text";
    codec: string;
    nb_samples: number;
    duration: number;
    timescale: number;
    track_width?: number;
    track_height?: number;
    video?: {
      width: number;
      height: number;
    };
    audio?: {
      sample_rate: number;
      channel_count: number;
    };
  }

  export interface Movie {
    duration: number;
    timescale: number;
    tracks: Track[];
  }

  export interface Sample {
    data: ArrayBuffer;
    cts: number;
    dts: number;
    duration: number;
    timescale: number;
    is_sync: boolean;
    size: number;
  }

  export interface MP4BoxBuffer extends ArrayBuffer {
    fileStart: number;
  }

  export interface SampleEntry {
    avcC?: {
      write(stream: DataStream): void;
    };
    hvcC?: {
      write(stream: DataStream): void;
    };
    esds?: {
      esd: {
        descs: Array<{ data?: Uint8Array }>;
      };
    };
  }

  export interface TrackInfo {
    mdia: {
      minf: {
        stbl: {
          stsd: {
            entries: SampleEntry[];
          };
        };
      };
    };
  }

  export interface DataStream {
    buffer: ArrayBuffer;
  }

  export const DataStream: {
    new (
      buffer: ArrayBuffer | undefined,
      byteOffset: number,
      endianness: boolean,
    ): DataStream;
    BIG_ENDIAN: boolean;
    LITTLE_ENDIAN: boolean;
  };

  export interface ISOFile {
    onReady?: (info: Movie) => void;
    onError?: (e: string) => void;
    onSamples?: (trackId: number, user: unknown, samples: Sample[]) => void;
    appendBuffer(buffer: MP4BoxBuffer): number;
    flush(): void;
    start(): void;
    seek(time: number, useRap?: boolean): { offset: number; time: number };
    setExtractionOptions(
      trackId: number,
      user: unknown,
      options?: { nbSamples?: number },
    ): void;
    getTrackById(id: number): TrackInfo | undefined;
  }

  export function createFile(useSegments?: boolean): ISOFile;
}
