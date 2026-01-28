/**
 * Decart AI provider for real-time and batch video/image generation
 *
 * Supports batch video transformation (Lucy models) and synchronous image generation.
 * Real-time WebRTC streaming (Mirage, Lucy RT, Avatar Live) is available via
 * the convenience methods that expose the underlying SDK's realtime client.
 *
 * @see https://docs.platform.decart.ai
 */

import {
  createDecartClient,
  models as decartModels,
  type JobStatusResponse,
  type QueueJobResult,
} from "@decartai/sdk";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider, ensureUrl } from "./base";

// Lazy-initialize client to avoid import-time errors when key is absent
let _client: ReturnType<typeof createDecartClient> | null = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.DECART_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DECART_API_KEY environment variable is required. " +
          "Get one at https://platform.decart.ai",
      );
    }
    _client = createDecartClient({ apiKey });
  }
  return _client;
}

// --------------------------------------------------------------------------
// Internal job tracking
// --------------------------------------------------------------------------

interface DecartJobInfo {
  model: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: Blob;
  error?: string;
}

/**
 * Decart provider — wraps the @decartai/sdk for both batch (queue) and
 * synchronous (process) workflows.
 *
 * Batch models (video):
 *   lucy-pro-v2v, lucy-fast-v2v, lucy-pro-t2v, lucy-pro-i2v,
 *   lucy-dev-i2v, lucy-motion, lucy-pro-flf2v, lucy-restyle-v2v
 *
 * Sync models (image):
 *   lucy-pro-t2i, lucy-pro-i2i
 *
 * Realtime models (WebRTC, browser-only):
 *   mirage, mirage_v2, lucy_v2v_720p_rt, lucy_v2v_14b_rt, live_avatar
 */
export class DecartProvider extends BaseProvider {
  readonly name = "decart";

  // Track jobs by an internal ID since the SDK uses its own job_id
  private jobs = new Map<string, DecartJobInfo>();
  private sdkJobMap = new Map<string, string>(); // internalId -> sdkJobId

  // -----------------------------------------------------------------------
  // Provider interface (submit / getStatus / getResult)
  // -----------------------------------------------------------------------

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const client = getClient();
    const internalId = `decart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Determine if this is a video (queue) or image (process) model
    const isImage = model === "lucy-pro-t2i" || model === "lucy-pro-i2i";

    if (isImage) {
      // Synchronous image generation — result is available immediately
      this.jobs.set(internalId, { model, status: "processing" });

      try {
        const imageModel =
          model === "lucy-pro-t2i"
            ? decartModels.image("lucy-pro-t2i")
            : decartModels.image("lucy-pro-i2i");

        // Build process options — handle file inputs
        const processInputs: Record<string, unknown> = { model: imageModel };
        if (inputs.prompt) processInputs.prompt = inputs.prompt as string;
        if (inputs.seed) processInputs.seed = inputs.seed;
        if (inputs.resolution) processInputs.resolution = inputs.resolution;
        if (inputs.orientation) processInputs.orientation = inputs.orientation;
        if (inputs.enhance_prompt)
          processInputs.enhance_prompt = inputs.enhance_prompt;

        // Handle file data for i2i
        if (inputs.data) {
          processInputs.data = await this.resolveFileInput(
            inputs.data as string,
          );
        }

        const result = await client.process(processInputs as never);
        const blob = result as Blob;

        // Convert blob to a URL by uploading or creating object URL representation
        this.jobs.set(internalId, { model, status: "completed", result: blob });
      } catch (error) {
        this.jobs.set(internalId, {
          model,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return internalId;
    }

    // Video model — use queue API
    this.jobs.set(internalId, { model, status: "pending" });

    const videoModel = this.resolveVideoModel(model);

    // Build queue submit options
    const queueInputs: Record<string, unknown> = { model: videoModel };
    if (inputs.prompt) queueInputs.prompt = inputs.prompt;
    if (inputs.seed) queueInputs.seed = inputs.seed;
    if (inputs.resolution) queueInputs.resolution = inputs.resolution;
    if (inputs.enhance_prompt)
      queueInputs.enhance_prompt = inputs.enhance_prompt;
    if (inputs.num_inference_steps)
      queueInputs.num_inference_steps = inputs.num_inference_steps;

    // Handle file inputs (data, reference_image, start, end)
    for (const fileKey of ["data", "reference_image", "start", "end"]) {
      if (inputs[fileKey]) {
        queueInputs[fileKey] = await this.resolveFileInput(
          inputs[fileKey] as string,
        );
      }
    }

    // Handle trajectory for lucy-motion
    if (inputs.trajectory) {
      queueInputs.trajectory = inputs.trajectory;
    }

    try {
      const job = await client.queue.submit(queueInputs as never);
      this.sdkJobMap.set(internalId, job.job_id);
      this.jobs.set(internalId, { model, status: "pending" });
    } catch (error) {
      this.jobs.set(internalId, {
        model,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return internalId;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const info = this.jobs.get(jobId);
    if (!info) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    // If already terminal, return cached status
    if (info.status === "completed" || info.status === "failed") {
      return {
        status: info.status,
        error: info.error,
      };
    }

    // For image jobs, status was set synchronously in submit()
    const isImage =
      info.model === "lucy-pro-t2i" || info.model === "lucy-pro-i2i";
    if (isImage) {
      return { status: info.status };
    }

    // For video jobs, poll the SDK
    const sdkJobId = this.sdkJobMap.get(jobId);
    if (!sdkJobId) {
      return { status: info.status };
    }

    try {
      const client = getClient();
      const status = await client.queue.status(sdkJobId);

      const mappedStatus = this.mapStatus(status.status);
      this.jobs.set(jobId, { ...info, status: mappedStatus });

      // If completed, fetch the result blob
      if (mappedStatus === "completed") {
        try {
          const blob = await client.queue.result(sdkJobId);
          this.jobs.set(jobId, {
            ...info,
            status: "completed",
            result: blob,
          });
        } catch {
          // Result fetch can fail separately; status is still completed
        }
      }

      return { status: mappedStatus };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getResult(jobId: string): Promise<unknown> {
    const info = this.jobs.get(jobId);
    if (!info) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    if (info.status === "failed") {
      throw new Error(info.error ?? "Job failed");
    }

    if (info.result) {
      // Write blob to a temp file and return the path
      const ext =
        info.model.includes("t2i") || info.model.includes("i2i")
          ? "png"
          : "mp4";
      const outputPath = `output/decart-${jobId}.${ext}`;
      const buffer = await info.result.arrayBuffer();
      await Bun.write(outputPath, buffer);

      // Clean up
      this.jobs.delete(jobId);
      this.sdkJobMap.delete(jobId);

      return { url: outputPath, type: ext === "mp4" ? "video" : "image" };
    }

    // If no cached result, try fetching from SDK
    const sdkJobId = this.sdkJobMap.get(jobId);
    if (sdkJobId) {
      const client = getClient();
      const blob = await client.queue.result(sdkJobId);
      const ext =
        info.model.includes("t2i") || info.model.includes("i2i")
          ? "png"
          : "mp4";
      const outputPath = `output/decart-${jobId}.${ext}`;
      const buffer = await blob.arrayBuffer();
      await Bun.write(outputPath, buffer);

      // Clean up
      this.jobs.delete(jobId);
      this.sdkJobMap.delete(jobId);

      return { url: outputPath, type: ext === "mp4" ? "video" : "image" };
    }

    throw new Error("Result not yet available");
  }

  // -----------------------------------------------------------------------
  // High-level convenience methods
  // -----------------------------------------------------------------------

  /**
   * Transform a video with a text prompt (video-to-video).
   * Uses lucy-pro-v2v for best quality or lucy-fast-v2v for speed.
   */
  async videoToVideo(args: {
    prompt: string;
    videoPath: string;
    fast?: boolean;
    referenceImage?: string;
    enhancePrompt?: boolean;
  }): Promise<QueueJobResult> {
    const client = getClient();
    const modelName = args.fast ? "lucy-fast-v2v" : "lucy-pro-v2v";
    const model = decartModels.video(modelName as "lucy-pro-v2v");

    console.log(`[decart] starting video-to-video: ${modelName}`);
    console.log(`[decart] prompt: ${args.prompt}`);

    const data = await this.resolveFileInput(args.videoPath);
    const referenceImage = args.referenceImage
      ? await this.resolveFileInput(args.referenceImage)
      : undefined;

    const result = await client.queue.submitAndPoll({
      model,
      prompt: args.prompt,
      data,
      ...(referenceImage && { reference_image: referenceImage }),
      enhance_prompt: args.enhancePrompt ?? true,
      onStatusChange: (job: JobStatusResponse) => {
        console.log(`[decart] job ${job.job_id}: ${job.status}`);
      },
    } as never);

    console.log(`[decart] completed with status: ${result.status}`);
    return result;
  }

  /**
   * Generate a video from a text prompt (text-to-video).
   */
  async textToVideo(args: {
    prompt: string;
    resolution?: "480p" | "720p";
    orientation?: "landscape" | "portrait";
  }): Promise<QueueJobResult> {
    const client = getClient();
    const model = decartModels.video("lucy-pro-t2v");

    console.log("[decart] starting text-to-video: lucy-pro-t2v");
    console.log(`[decart] prompt: ${args.prompt}`);

    const result = await client.queue.submitAndPoll({
      model,
      prompt: args.prompt,
      resolution: args.resolution ?? "720p",
      orientation: args.orientation,
      onStatusChange: (job: JobStatusResponse) => {
        console.log(`[decart] job ${job.job_id}: ${job.status}`);
      },
    } as never);

    console.log(`[decart] completed with status: ${result.status}`);
    return result;
  }

  /**
   * Animate an image into video (image-to-video).
   */
  async imageToVideo(args: {
    prompt: string;
    imagePath: string;
    resolution?: "480p" | "720p";
  }): Promise<QueueJobResult> {
    const client = getClient();
    const model = decartModels.video("lucy-pro-i2v");

    console.log("[decart] starting image-to-video: lucy-pro-i2v");
    console.log(`[decart] prompt: ${args.prompt}`);

    const data = await this.resolveFileInput(args.imagePath);

    const result = await client.queue.submitAndPoll({
      model,
      prompt: args.prompt,
      data,
      resolution: args.resolution ?? "720p",
      onStatusChange: (job: JobStatusResponse) => {
        console.log(`[decart] job ${job.job_id}: ${job.status}`);
      },
    } as never);

    console.log(`[decart] completed with status: ${result.status}`);
    return result;
  }

  /**
   * Generate an image from text (text-to-image).
   */
  async textToImage(args: {
    prompt: string;
    resolution?: "480p" | "720p";
    orientation?: "landscape" | "portrait";
  }): Promise<Blob> {
    const client = getClient();

    console.log("[decart] starting text-to-image: lucy-pro-t2i");
    console.log(`[decart] prompt: ${args.prompt}`);

    const result = await client.process({
      model: decartModels.image("lucy-pro-t2i"),
      prompt: args.prompt,
      resolution: args.resolution ?? "720p",
      orientation: args.orientation,
    } as never);

    console.log("[decart] completed!");
    return result as Blob;
  }

  /**
   * Edit an image with a text prompt (image-to-image).
   */
  async imageToImage(args: {
    prompt: string;
    imagePath: string;
    resolution?: "480p" | "720p";
    enhancePrompt?: boolean;
  }): Promise<Blob> {
    const client = getClient();

    console.log("[decart] starting image-to-image: lucy-pro-i2i");
    console.log(`[decart] prompt: ${args.prompt}`);

    const data = await this.resolveFileInput(args.imagePath);

    const result = await client.process({
      model: decartModels.image("lucy-pro-i2i"),
      prompt: args.prompt,
      data,
      resolution: args.resolution ?? "720p",
      enhance_prompt: args.enhancePrompt ?? true,
    } as never);

    console.log("[decart] completed!");
    return result as Blob;
  }

  /**
   * Restyle a video using a text prompt or reference image.
   */
  async restyleVideo(args: {
    videoPath: string;
    prompt?: string;
    referenceImagePath?: string;
    enhancePrompt?: boolean;
  }): Promise<QueueJobResult> {
    const client = getClient();
    const model = decartModels.video("lucy-restyle-v2v" as "lucy-pro-v2v");

    console.log("[decart] starting restyle: lucy-restyle-v2v");

    const data = await this.resolveFileInput(args.videoPath);
    const referenceImage = args.referenceImagePath
      ? await this.resolveFileInput(args.referenceImagePath)
      : undefined;

    const result = await client.queue.submitAndPoll({
      model,
      ...(args.prompt && { prompt: args.prompt }),
      data,
      ...(referenceImage && { reference_image: referenceImage }),
      enhance_prompt: args.enhancePrompt ?? true,
      onStatusChange: (job: JobStatusResponse) => {
        console.log(`[decart] job ${job.job_id}: ${job.status}`);
      },
    } as never);

    console.log(`[decart] completed with status: ${result.status}`);
    return result;
  }

  // -----------------------------------------------------------------------
  // Realtime API access (exposes SDK client for WebRTC usage)
  // -----------------------------------------------------------------------

  /**
   * Get the underlying Decart SDK client for realtime WebRTC operations.
   * This is intended for browser-side usage or server-side WebRTC proxying.
   *
   * @example
   * ```ts
   * const sdkClient = decartProvider.getRealtimeClient();
   * const rt = await sdkClient.realtime.connect(mediaStream, {
   *   model: models.realtime("mirage_v2"),
   *   onRemoteStream: (stream) => { video.srcObject = stream; },
   *   initialState: { prompt: { text: "Anime style" } }
   * });
   * rt.setPrompt("Cyberpunk city");
   * ```
   */
  getRealtimeClient() {
    return getClient();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private resolveVideoModel(model: string) {
    const videoModelNames = [
      "lucy-pro-v2v",
      "lucy-fast-v2v",
      "lucy-pro-t2v",
      "lucy-pro-i2v",
      "lucy-dev-i2v",
      "lucy-motion",
      "lucy-pro-flf2v",
      "lucy-restyle-v2v",
    ] as const;

    type VideoModelName = (typeof videoModelNames)[number];

    if (videoModelNames.includes(model as VideoModelName)) {
      return decartModels.video(model as VideoModelName);
    }
    // Default fallback
    return decartModels.video("lucy-pro-v2v");
  }

  private mapStatus(
    sdkStatus: string,
  ): "pending" | "processing" | "completed" | "failed" {
    switch (sdkStatus) {
      case "completed":
        return "completed";
      case "failed":
        return "failed";
      case "processing":
        return "processing";
      case "pending":
      default:
        return "pending";
    }
  }

  private async resolveFileInput(pathOrUrl: string): Promise<Blob> {
    // URL — fetch it
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      const response = await fetch(pathOrUrl);
      return await response.blob();
    }

    // Local file — read with Bun
    const file = Bun.file(pathOrUrl);
    if (!(await file.exists())) {
      throw new Error(`Local file not found: ${pathOrUrl}`);
    }

    const buffer = await file.arrayBuffer();
    const ext = pathOrUrl.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
    };
    return new Blob([buffer], {
      type: mimeMap[ext] ?? "application/octet-stream",
    });
  }
}

// Export singleton instance
export const decartProvider = new DecartProvider();

// Re-export convenience functions for backward compatibility
export const videoToVideo = (
  args: Parameters<DecartProvider["videoToVideo"]>[0],
) => decartProvider.videoToVideo(args);
export const decartTextToVideo = (
  args: Parameters<DecartProvider["textToVideo"]>[0],
) => decartProvider.textToVideo(args);
export const decartImageToVideo = (
  args: Parameters<DecartProvider["imageToVideo"]>[0],
) => decartProvider.imageToVideo(args);
export const decartTextToImage = (
  args: Parameters<DecartProvider["textToImage"]>[0],
) => decartProvider.textToImage(args);
export const decartImageToImage = (
  args: Parameters<DecartProvider["imageToImage"]>[0],
) => decartProvider.imageToImage(args);
export const restyleVideo = (
  args: Parameters<DecartProvider["restyleVideo"]>[0],
) => decartProvider.restyleVideo(args);
