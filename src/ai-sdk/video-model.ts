/**
 * VideoModelV3 - Extension to AI SDK for video generation
 *
 * This follows the same patterns as ImageModelV3 but adds video-specific
 * options like duration, fps, and supports multimodal inputs via `files`.
 *
 * When upstream merges video support, we can migrate to their types.
 */

import type {
  JSONArray,
  JSONValue,
  SharedV3ProviderOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";

// ============================================================================
// File Types (matching ImageModelV3File pattern)
// ============================================================================

export type VideoModelV3File =
  | {
      type: "file";
      /**
       * The IANA media type of the file, e.g. `image/png`, `audio/mp3`, `video/mp4`.
       * @see https://www.iana.org/assignments/media-types/media-types.xhtml
       */
      mediaType: string;
      /**
       * File data as base64 encoded string or binary data.
       */
      data: string | Uint8Array;
    }
  | {
      type: "url";
      /**
       * URL to the file. Must be publicly accessible.
       */
      url: string;
      /**
       * Optional media type hint for the URL.
       */
      mediaType?: string;
    };

// ============================================================================
// Call Options
// ============================================================================

export type VideoModelV3CallOptions = {
  /**
   * Prompt for the video generation.
   */
  prompt: string;

  /**
   * Number of videos to generate.
   */
  n: number;

  /**
   * Resolution of the videos to generate.
   * Must have the format `{width}x{height}`.
   * `undefined` will use the provider's default resolution.
   */
  resolution: `${number}x${number}` | undefined;

  /**
   * Aspect ratio of the videos to generate.
   * Must have the format `{width}:{height}`.
   * `undefined` will use the provider's default aspect ratio.
   */
  aspectRatio: `${number}:${number}` | undefined;

  /**
   * Duration of the generated video in seconds.
   * `undefined` will use the provider's default duration.
   */
  duration: number | undefined;

  /**
   * Frames per second of the generated video.
   * `undefined` will use the provider's default FPS.
   */
  fps: number | undefined;

  /**
   * Seed for the generation.
   * `undefined` will use the provider's default seed.
   */
  seed: number | undefined;

  /**
   * Input files for video generation.
   * - Images: for image-to-video generation
   * - Audio: for audio-reactive video generation
   * - Video: for video-to-video style transfer, extension, etc.
   */
  files: VideoModelV3File[] | undefined;

  /**
   * Additional provider-specific options.
   */
  providerOptions: SharedV3ProviderOptions;

  /**
   * Abort signal for cancelling the operation.
   */
  abortSignal?: AbortSignal;

  /**
   * Additional HTTP headers to be sent with the request.
   */
  headers?: Record<string, string | undefined>;
};

// ============================================================================
// Provider Metadata
// ============================================================================

export type VideoModelV3ProviderMetadata = Record<
  string,
  {
    videos: JSONArray;
  } & JSONValue
>;

// ============================================================================
// Usage
// ============================================================================

export type VideoModelV3Usage = {
  /** Input tokens used (if applicable) */
  inputTokens?: number;
  /** Output tokens used (if applicable) */
  outputTokens?: number;
  /** Total tokens used */
  totalTokens?: number;
};

// ============================================================================
// Model Interface
// ============================================================================

type GetMaxVideosPerCallFunction = (options: {
  modelId: string;
}) => PromiseLike<number | undefined> | number | undefined;

/**
 * Video generation model specification version 3.
 * Follows the same patterns as ImageModelV3.
 */
export type VideoModelV3 = {
  /**
   * The video model must specify which video model interface version it implements.
   */
  readonly specificationVersion: "v3";

  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;

  /**
   * Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;

  /**
   * Limit of how many videos can be generated in a single API call.
   */
  readonly maxVideosPerCall: number | undefined | GetMaxVideosPerCallFunction;

  /**
   * Generates videos.
   */
  doGenerate(options: VideoModelV3CallOptions): PromiseLike<{
    /**
     * Generated videos as base64 encoded strings or binary data.
     */
    videos: Array<string> | Array<Uint8Array>;

    /**
     * Warnings for the call, e.g. unsupported features.
     */
    warnings: Array<SharedV3Warning>;

    /**
     * Additional provider-specific metadata.
     */
    providerMetadata?: VideoModelV3ProviderMetadata;

    /**
     * Response information for telemetry and debugging purposes.
     */
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };

    /**
     * Optional token usage for the video generation call.
     */
    usage?: VideoModelV3Usage;
  }>;
};
