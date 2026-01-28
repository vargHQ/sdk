/**
 * FFmpeg backend abstraction for dependency injection
 * Allows switching between local ffmpeg and cloud services like Rendi
 */

import type { VideoInfo } from "../types";

/**
 * Represents the result of running ffprobe
 */
export type { VideoInfo };

/**
 * FFmpeg execution options
 */
export interface FFmpegRunOptions {
  /** ffmpeg arguments (without the 'ffmpeg' command itself) */
  args: string[];
  /** List of input file paths (local or URLs) */
  inputs: string[];
  /** Output file path */
  outputPath: string;
  /** Enable verbose logging */
  verbose?: boolean;
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
   * Run ffmpeg command
   * @param options - Execution options including args, inputs, and output path
   */
  run(options: FFmpegRunOptions): Promise<void>;
}
