/**
 * FFmpeg backend abstraction for dependency injection
 * Allows switching between local ffmpeg and cloud services like Rendi
 */

import type { File } from "../../../file";
import type { VideoInfo } from "../types";

/**
 * Represents the result of running ffprobe
 */
export type { VideoInfo };

export type FilePath = File | string;

/**
 * Represents an input to ffmpeg - can be a simple path/URL, File, or structured with options
 */
export type FFmpegInput =
  | FilePath
  | {
      /** Path, URL, or File for the input */
      path: FilePath;
      /** Options to apply BEFORE the -i flag (e.g. -ss 5 for seeking) */
      options?: string[];
    }
  | {
      /** Raw ffmpeg args that don't use -i (e.g. ["-f", "lavfi", "-i", "color=black"]) */
      raw: string[];
    };

/**
 * FFmpeg execution options - new interface where backend builds -i flags
 */
export interface FFmpegRunOptions {
  /** Inputs - backend builds -i flags from these */
  inputs: FFmpegInput[];
  /** Filter complex string (uses input indices like [0:v], [1:a]) */
  filterComplex?: string;
  /** Video filter string for single-input operations */
  videoFilter?: string;
  /** Arguments after inputs but before output (codec, map, etc) */
  outputArgs?: string[];
  /** Output file path */
  outputPath: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

export type FFmpegOutput =
  | { type: "file"; path: string }
  | { type: "url"; url: string };

export interface FFmpegRunResult {
  output: FFmpegOutput;
}

/**
 * Backend interface for ffmpeg/ffprobe execution
 */
export interface FFmpegBackend {
  /** Backend name for identification */
  readonly name: string;

  /**
   * Run ffprobe to get media file info
   * @param input - File path (local) or URL
   */
  ffprobe(input: string): Promise<VideoInfo>;

  /**
   * Resolve a FilePath to a string path/URL for ffmpeg
   * Local backend: returns URL if available, otherwise writes to temp
   * Rendi backend: uploads local files, returns URL
   */
  resolvePath(path: FilePath): Promise<string>;

  /**
   * Run ffmpeg command
   * @param options - Execution options including args, inputs, and output path
   * @returns Result with optional URL for cloud backends
   */
  run(options: FFmpegRunOptions): Promise<FFmpegRunResult>;
}
