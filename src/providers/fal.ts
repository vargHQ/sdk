/**
 * fal.ai provider for video and image generation
 * Supports Kling, Flux, Wan and other models
 */

import { fal } from "@fal-ai/client";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider, ensureUrl } from "./base";

const falApiKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
if (falApiKey) {
  fal.config({ credentials: falApiKey });
}

export class FalProvider extends BaseProvider {
  readonly name = "fal";

  // Track model per job for status/result calls
  private jobModels = new Map<string, string>();

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    // Handle nano-banana-pro routing: use /edit endpoint when image_urls provided
    const resolvedModel = this.resolveModelEndpoint(model, inputs);

    // Upload local files if needed
    const processedInputs = await this.processInputs(inputs);

    const result = await fal.queue.submit(resolvedModel, {
      input: processedInputs,
    });

    // Store model for later status/result calls
    this.jobModels.set(result.request_id, resolvedModel);

    return result.request_id;
  }

  /**
   * Resolve model endpoint based on inputs
   * Handles special routing for models like nano-banana-pro (text-to-image vs image-to-image)
   */
  private resolveModelEndpoint(
    model: string,
    inputs: Record<string, unknown>,
  ): string {
    // Nano Banana Pro: use /edit endpoint when image_urls are provided
    if (model === "fal-ai/nano-banana-pro") {
      const imageUrls = inputs.image_urls as string[] | undefined;
      if (imageUrls && imageUrls.length > 0) {
        return "fal-ai/nano-banana-pro/edit";
      }
    }
    // Nano Banana 2: route to /edit when image_urls are provided, otherwise use base t2i endpoint
    if (model === "fal-ai/nano-banana-2") {
      const imageUrls = inputs.image_urls as string[] | undefined;
      if (imageUrls && imageUrls.length > 0) {
        return "fal-ai/nano-banana-2/edit";
      }
      return "fal-ai/nano-banana-2";
    }
    // Qwen Image 2: route to /edit endpoint when image_urls are provided
    if (model === "fal-ai/qwen-image-2/text-to-image") {
      const imageUrls = inputs.image_urls as string[] | undefined;
      if (imageUrls && imageUrls.length > 0) {
        return "fal-ai/qwen-image-2/edit";
      }
    }
    if (model === "fal-ai/qwen-image-2/pro/text-to-image") {
      const imageUrls = inputs.image_urls as string[] | undefined;
      if (imageUrls && imageUrls.length > 0) {
        return "fal-ai/qwen-image-2/pro/edit";
      }
    }
    return model;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const model = this.jobModels.get(jobId);
    if (!model) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    const status = await fal.queue.status(model, { requestId: jobId });

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
    const model = this.jobModels.get(jobId);
    if (!model) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    const result = await fal.queue.result(model, { requestId: jobId });

    // Clean up job model mapping after getting result
    this.jobModels.delete(jobId);

    return result.data;
  }

  override async uploadFile(
    file: File | Blob | ArrayBuffer,
    _filename?: string,
  ): Promise<string> {
    const blob =
      file instanceof ArrayBuffer
        ? new Blob([file])
        : file instanceof Blob
          ? file
          : file;

    const url = await fal.storage.upload(blob);
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
        aspect_ratio: (args.aspectRatio || "1:1") as
          | "16:9"
          | "9:16"
          | "1:1"
          | "21:9"
          | "3:2"
          | "4:3"
          | "5:4"
          | "4:5"
          | "3:4"
          | "2:3",
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

  async omnihuman15(args: {
    imageUrl: string;
    audioUrl: string;
    prompt?: string;
    turboMode?: boolean;
    resolution?: "720p" | "1080p";
  }) {
    const modelId: string = "fal-ai/bytedance/omnihuman/v1.5";

    console.log(`[fal] starting omnihuman v1.5: ${modelId}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );
    const audioUrl = await ensureUrl(args.audioUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const input: Record<string, unknown> = {
      ...(args.prompt ? { prompt: args.prompt } : {}),
      image_url: imageUrl,
      audio_url: audioUrl,
      turbo_mode: args.turboMode ?? false,
      resolution: args.resolution ?? "1080p",
    };

    const result = await fal.subscribe(modelId, {
      input,
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

  async veedFabric10(args: {
    imageUrl: string;
    audioUrl: string;
    resolution: "480p" | "720p";
  }) {
    const modelId: string = "veed/fabric-1.0";

    console.log(`[fal] starting veed fabric 1.0: ${modelId}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );
    const audioUrl = await ensureUrl(args.audioUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const input: Record<string, unknown> = {
      image_url: imageUrl,
      audio_url: audioUrl,
      resolution: args.resolution,
    };

    const result = await fal.subscribe(modelId, {
      input,
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

  async ltx2AudioToVideo(args: {
    prompt: string;
    audioUrl: string;
    imageUrl?: string;
    matchAudioLength?: boolean;
    numFrames?: number;
    videoSize?: string;
    useMultiscale?: boolean;
    fps?: number;
    guidanceScale?: number;
    numInferenceSteps?: number;
    seed?: number;
    enablePromptExpansion?: boolean;
    audioStrength?: number;
    imageStrength?: number;
  }) {
    const modelId: string = "fal-ai/ltx-2-19b/audio-to-video";

    console.log(`[fal] starting LTX-2 audio-to-video: ${modelId}`);

    const audioUrl = await ensureUrl(args.audioUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const input: Record<string, unknown> = {
      prompt: args.prompt,
      audio_url: audioUrl,
      match_audio_length: args.matchAudioLength ?? true,
      use_multiscale: args.useMultiscale ?? true,
      enable_prompt_expansion: args.enablePromptExpansion ?? true,
    };

    if (args.imageUrl) {
      input.image_url = await ensureUrl(args.imageUrl, (buffer) =>
        this.uploadFile(buffer),
      );
    }
    if (args.numFrames !== undefined) input.num_frames = args.numFrames;
    if (args.videoSize) input.video_size = args.videoSize;
    if (args.fps !== undefined) input.fps = args.fps;
    if (args.guidanceScale !== undefined)
      input.guidance_scale = args.guidanceScale;
    if (args.numInferenceSteps !== undefined)
      input.num_inference_steps = args.numInferenceSteps;
    if (args.seed !== undefined) input.seed = args.seed;
    if (args.audioStrength !== undefined)
      input.audio_strength = args.audioStrength;
    if (args.imageStrength !== undefined)
      input.image_strength = args.imageStrength;

    const result = await fal.subscribe(modelId, {
      input,
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

  // ============================================================================
  // Grok Imagine Video methods (xAI)
  // ============================================================================

  /**
   * Generate video from text using Grok Imagine Video
   * Supports 1-15 second videos at 480p or 720p resolution
   */
  async grokTextToVideo(args: {
    prompt: string;
    duration?: number;
    aspectRatio?: "16:9" | "4:3" | "3:2" | "1:1" | "2:3" | "3:4" | "9:16";
    resolution?: "480p" | "720p";
  }) {
    const modelId = "xai/grok-imagine-video/text-to-video";

    console.log(`[fal] starting grok text-to-video: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        duration: args.duration ?? 6,
        aspect_ratio: args.aspectRatio ?? "16:9",
        resolution: args.resolution ?? "720p",
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

  /**
   * Generate video from image using Grok Imagine Video
   * Supports 1-15 second videos at 480p or 720p resolution
   */
  async grokImageToVideo(args: {
    prompt: string;
    imageUrl: string;
    duration?: number;
    aspectRatio?:
      | "auto"
      | "16:9"
      | "4:3"
      | "3:2"
      | "1:1"
      | "2:3"
      | "3:4"
      | "9:16";
    resolution?: "480p" | "720p";
  }) {
    const modelId = "xai/grok-imagine-video/image-to-video";

    console.log(`[fal] starting grok image-to-video: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: imageUrl,
        duration: args.duration ?? 6,
        aspect_ratio: args.aspectRatio ?? "auto",
        resolution: args.resolution ?? "720p",
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

  // ============================================================================
  // Video-to-Video
  // ============================================================================

  /**
   * Motion control — transfer motion from reference video to character image
   * Uses Kling V3 Pro motion control endpoint
   */
  async motionControl(args: {
    prompt: string;
    imageUrl: string;
    videoUrl: string;
    characterOrientation?: "image" | "video";
    keepOriginalSound?: boolean;
  }) {
    const modelId = "fal-ai/kling-video/v3/pro/motion-control";

    console.log(`[fal] starting motion control: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );
    const videoUrl = await ensureUrl(args.videoUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: imageUrl,
        video_url: videoUrl,
        character_orientation: args.characterOrientation ?? "video",
        keep_original_sound: args.keepOriginalSound ?? true,
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

  /**
   * Video-to-video reference — generate new video guided by reference video,
   * preserving motion and camera style (Kling O3 Standard)
   */
  async videoToVideoReference(args: {
    prompt: string;
    videoUrl: string;
    duration?: number;
    aspectRatio?: "auto" | "16:9" | "9:16" | "1:1";
    keepAudio?: boolean;
  }) {
    const modelId = "fal-ai/kling-video/o3/standard/video-to-video/reference";

    console.log(`[fal] starting v2v reference: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const videoUrl = await ensureUrl(args.videoUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        video_url: videoUrl,
        duration: args.duration ? String(args.duration) : undefined,
        aspect_ratio: args.aspectRatio ?? "auto",
        keep_audio: args.keepAudio ?? true,
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

  /**
   * Edit video using Grok Imagine Video
   * Video will be resized to max 854x480 and truncated to 8 seconds
   */
  async grokEditVideo(args: {
    prompt: string;
    videoUrl: string;
    resolution?: "auto" | "480p" | "720p";
  }) {
    const modelId = "xai/grok-imagine-video/edit-video";

    console.log(`[fal] starting grok edit-video: ${modelId}`);
    console.log(`[fal] prompt: ${args.prompt}`);

    const videoUrl = await ensureUrl(args.videoUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        video_url: videoUrl,
        resolution: args.resolution ?? "auto",
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

  // ============================================================================
  // Qwen Image Edit 2511 Multiple Angles
  // ============================================================================

  /**
   * Adjust camera angle of an image using Qwen Image Edit 2511 Multiple Angles
   * Generates same scene from different angles (azimuth/elevation)
   */
  async qwenMultipleAngles(args: {
    imageUrl: string;
    horizontalAngle?: number;
    verticalAngle?: number;
    zoom?: number;
    additionalPrompt?: string;
    loraScale?: number;
    imageSize?: string | { width: number; height: number };
    guidanceScale?: number;
    numInferenceSteps?: number;
    acceleration?: "none" | "regular";
    negativePrompt?: string;
    seed?: number;
    outputFormat?: "png" | "jpeg" | "webp";
    numImages?: number;
  }) {
    const modelId = "fal-ai/qwen-image-edit-2511-multiple-angles";

    console.log(`[fal] starting qwen multiple angles: ${modelId}`);

    const imageUrl = await ensureUrl(args.imageUrl, (buffer) =>
      this.uploadFile(buffer),
    );

    const result = await fal.subscribe(modelId, {
      input: {
        image_urls: [imageUrl],
        horizontal_angle: args.horizontalAngle ?? 0,
        vertical_angle: args.verticalAngle ?? 0,
        zoom: args.zoom ?? 5,
        additional_prompt: args.additionalPrompt,
        lora_scale: args.loraScale ?? 1,
        image_size: args.imageSize,
        guidance_scale: args.guidanceScale ?? 4.5,
        num_inference_steps: args.numInferenceSteps ?? 28,
        acceleration: args.acceleration ?? "regular",
        negative_prompt: args.negativePrompt ?? "",
        seed: args.seed,
        output_format: args.outputFormat ?? "png",
        num_images: args.numImages ?? 1,
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
export const omnihuman15 = (args: Parameters<FalProvider["omnihuman15"]>[0]) =>
  falProvider.omnihuman15(args);
export const veedFabric10 = (
  args: Parameters<FalProvider["veedFabric10"]>[0],
) => falProvider.veedFabric10(args);
export const ltx2AudioToVideo = (
  args: Parameters<FalProvider["ltx2AudioToVideo"]>[0],
) => falProvider.ltx2AudioToVideo(args);
export const textToMusic = (args: Parameters<FalProvider["textToMusic"]>[0]) =>
  falProvider.textToMusic(args);
export const motionControl = (
  args: Parameters<FalProvider["motionControl"]>[0],
) => falProvider.motionControl(args);
export const videoToVideoReference = (
  args: Parameters<FalProvider["videoToVideoReference"]>[0],
) => falProvider.videoToVideoReference(args);
