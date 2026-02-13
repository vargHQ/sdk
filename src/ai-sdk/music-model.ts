/**
 * MusicModelV3 - Extension to AI SDK for music generation
 *
 * This follows the same patterns as SpeechModelV3 but for AI-generated music.
 * When upstream merges music support, we can migrate to their types.
 */

import type {
  JSONArray,
  JSONValue,
  SharedV3ProviderOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";

// ============================================================================
// Call Options
// ============================================================================

export type MusicModelV3CallOptions = {
  /**
   * Prompt describing the music to generate.
   */
  prompt: string;

  /**
   * Duration of the generated music in seconds.
   * `undefined` will use the provider's default duration.
   */
  duration: number | undefined;

  /**
   * Seed for reproducible generation.
   * `undefined` will use a random seed.
   */
  seed: number | undefined;

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

export type MusicModelV3ProviderMetadata = Record<
  string,
  {
    audio: JSONArray;
  } & JSONValue
>;

// ============================================================================
// Model Interface
// ============================================================================

/**
 * Music generation model specification version 3.
 * Follows the same patterns as SpeechModelV3.
 */
export type MusicModelV3 = {
  /**
   * The music model must specify which music model interface version it implements.
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
   * Generates music from a prompt.
   */
  doGenerate(options: MusicModelV3CallOptions): PromiseLike<{
    /**
     * Generated audio as binary data.
     */
    audio: Uint8Array;

    /**
     * Warnings for the call, e.g. unsupported features.
     */
    warnings: Array<SharedV3Warning>;

    /**
     * Additional provider-specific metadata.
     */
    providerMetadata?: MusicModelV3ProviderMetadata;

    /**
     * Response information for telemetry and debugging purposes.
     */
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
  }>;
};
