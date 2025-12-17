/**
 * fal.ai provider for video and image generation
 * Supports Kling, Flux, Wan and other models
 */

import { fal } from "@fal-ai/client";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider, ensureUrl } from "./base";

export class FalProvider extends BaseProvider {
  readonly name = "fal";

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    config?: ProviderConfig,
  ): Promise<string> {
    console.log(`[fal] submitting job for model: ${model}`);

    // Upload local files if needed
    const processedInputs = await this.processInputs(inputs);

    const result = await fal.queue.submit(model, {
      input: processedInputs,
    });

    console.log(`[fal] job submitted: ${result.request_id}`);
    return result.request_id;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const status = await fal.queue.status("", { requestId: jobId });

    const statusMap: Record<string, JobStatusUpdate["status"]> = {
      IN_QUEUE: "queued",
      IN_PROGRESS: "processing",
      COMPLETED: "completed",
      FAILED: "failed",
    };

    // @ts-expect-error - logs may exist on some status types
    const logs = status.logs?.map((l: { message: string }) => l.message);

    return {
      status: statusMap[status.status] ?? "processing",
      logs,
    };
  }

  async getResult(jobId: string): Promise<unknown> {
    const result = await fal.queue.result("", { requestId: jobId });
    return result.data;
  }

  override async uploadFile(
    file: File | Blob | ArrayBuffer,
    filename?: string,
  ): Promise<string> {
    console.log(`[fal] uploading file...`);

    const blob =
      file instanceof ArrayBuffer
        ? new Blob([file])
        : file instanceof Blob
          ? file
          : file;

    const url = await fal.storage.upload(blob);
    console.log(`[fal] uploaded to: ${url}`);
    return url;
  }

  /**
   * Process inputs, uploading local files as needed
   */
  private async processInputs(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === "string" && this.looksLikeLocalPath(value)) {
        processed[key] = await ensureUrl(value, (buffer) =>
          this.uploadFile(buffer),
        );
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  private looksLikeLocalPath(value: string): boolean {
    return (
      !value.startsWith("http://") &&
      !value.startsWith("https://") &&
      (value.includes("/") || value.includes("\\"))
    );
  }

  // ============================================================================
  // High-level convenience methods (preserved from original lib/fal.ts)
  // ============================================================================

  async imageToVideo(args: {
    prompt: string;
    imageUrl: string;
    modelVersion?: string;
    duration?: 5 | 10;
    tailImageUrl?: string;
  }) {
    const modelId = `fal-ai/kling-video/${args.modelVersion || "v2.5-turbo/pro"}/image-to-video`;

    console.log(`[fal] starting image-to-video: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );
    const tailImageUrl = args.tailImageUrl
      ? await ensureUrl(args.tailImageUrl, (buffer) => this.uploadFile(buffer))
      : undefined;

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: imageUrl,
        duration: args.duration || 5,
        ...(tailImageUrl && { tail_image_url: tailImageUrl }),
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  }

  async textToVideo(args: {
    prompt: string;
    modelVersion?: string;
    duration?: 5 | 10;
    aspectRatio?: "16:9" | "9:16" | "1:1";
  }) {
    const modelId = `fal-ai/kling-video/${args.modelVersion || "v2.5-turbo/pro"}/text-to-video`;

    console.log(`[fal] starting text-to-video: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        duration: args.duration || 5,
        aspect_ratio: args.aspectRatio || "16:9",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  }

  async generateImage(args: {
    prompt: string;
    model?: string;
    imageSize?: string;
  }) {
    const modelId = args.model || "fal-ai/flux-pro/v1.1";

    console.log(`[fal] generating image with ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_size: args.imageSize || "landscape_4_3",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  }

  async imageToImage(args: {
    prompt: string;
    imageUrl: string;
    aspectRatio?: string;
  }) {
    const modelId = "fal-ai/nano-banana-pro/edit";

    console.log(`[fal] starting image-to-image: ${modelId}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_urls: [imageUrl],
        aspect_ratio: args.aspectRatio || "auto",
        resolution: "2K",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  }

  async wan25(args: {
    prompt: string;
    imageUrl: string;
    audioUrl: string;
    resolution?: "480p" | "720p" | "1080p";
    duration?: "5" | "10";
    negativePrompt?: string;
  }) {
    const modelId = "fal-ai/wan-25-preview/image-to-video";

    console.log(`[fal] starting wan-25: ${modelId}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );
    const audioUrl = await ensureUrl(args.audioUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution: args.resolution || "480p",
        duration: args.duration || "5",
        negative_prompt:
          args.negativePrompt ||
          "low resolution, error, worst quality, low quality, defects",
        enable_prompt_expansion: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  }

  async textToMusic(args: {
    prompt?: string;
    tags?: string[];
    lyricsPrompt?: string;
    seed?: number;
    promptStrength?: number;
    balanceStrength?: number;
    numSongs?: 1 | 2;
    outputFormat?: "flac" | "mp3" | "wav" | "ogg" | "m4a";
    outputBitRate?: 128 | 192 | 256 | 320;
    bpm?: number | "auto";
  }) {
    const modelId = "fal-ai/sonauto/bark";

    console.log(`[fal] starting text-to-music: ${modelId}`);

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        tags: args.tags,
        lyrics_prompt: args.lyricsPrompt,
        seed: args.seed,
        prompt_strength: args.promptStrength,
        balance_strength: args.balanceStrength,
        num_songs: args.numSongs,
        output_format: args.outputFormat,
        output_bit_rate: args.outputBitRate,
        bpm: args.bpm,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  }
}

// Export singleton instance
export const falProvider = new FalProvider();

// Re-export convenience functions for backward compatibility
export const imageToVideo = (
  args: Parameters<FalProvider["imageToVideo"]>[0],
) => falProvider.imageToVideo(args);
export const textToVideo = (args: Parameters<FalProvider["textToVideo"]>[0]) =>
  falProvider.textToVideo(args);
export const generateImage = (
  args: Parameters<FalProvider["generateImage"]>[0],
) => falProvider.generateImage(args);
export const imageToImage = (
  args: Parameters<FalProvider["imageToImage"]>[0],
) => falProvider.imageToImage(args);
export const wan25 = (args: Parameters<FalProvider["wan25"]>[0]) =>
  falProvider.wan25(args);
export const textToMusic = (args: Parameters<FalProvider["textToMusic"]>[0]) =>
  falProvider.textToMusic(args);
