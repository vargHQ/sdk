/**
 * PiAPI provider for Seedance video generation
 * Supports text-to-video, image-to-video, and video editing via ByteDance's Seedance models
 */

import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

const PIAPI_BASE_URL = "https://api.piapi.ai";

/** PiAPI task response shape. */
interface PiAPITaskData {
  task_id: string;
  model: string;
  task_type: string;
  status: string;
  input: Record<string, unknown>;
  output: { video?: string } | null;
  meta: {
    created_at: string;
    started_at: string;
    ended_at: string;
    usage: { type: string; frozen: number; consume: number };
    is_using_private_pool: boolean;
  };
  error: {
    code: number;
    message: string;
    raw_message?: string;
    detail?: unknown;
  };
  logs: unknown[];
}

interface PiAPIResponse {
  code: number;
  data: PiAPITaskData;
  message: string;
}

export class PiAPIProvider extends BaseProvider {
  readonly name = "piapi";
  private apiKey: string;

  constructor(config?: ProviderConfig) {
    super({
      timeout: 3600000, // 1 hour default (seedance can be slow during peak)
      ...config,
    });
    this.apiKey = config?.apiKey || process.env.PIAPI_API_KEY || "";
  }

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const taskType = (inputs.task_type as string) || model;
    const prompt = (inputs.prompt as string) || "";
    const duration = inputs.duration as number | undefined;
    const aspectRatio = inputs.aspect_ratio as string | undefined;
    const imageUrls = inputs.image_urls as string[] | undefined;
    const videoUrls = inputs.video_urls as string[] | undefined;
    const parentTaskId = inputs.parent_task_id as string | undefined;

    const requestBody: Record<string, unknown> = {
      model: "seedance",
      task_type: taskType,
      input: {
        prompt,
        ...(duration != null ? { duration } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(imageUrls?.length ? { image_urls: imageUrls } : {}),
        ...(videoUrls?.length ? { video_urls: videoUrls } : {}),
        ...(parentTaskId ? { parent_task_id: parentTaskId } : {}),
      },
    };

    const response = await fetch(`${PIAPI_BASE_URL}/api/v1/task`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`piapi submit failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as PiAPIResponse;
    const taskId = data.data?.task_id;

    if (!taskId) {
      throw new Error("no task_id in piapi response");
    }

    console.log(`[piapi] task submitted: ${taskId} (${taskType})`);
    return taskId;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const res = await fetch(`${PIAPI_BASE_URL}/api/v1/task/${jobId}`, {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`piapi status check failed (${res.status})`);
    }

    const body = (await res.json()) as PiAPIResponse;
    const status = body.data?.status?.toLowerCase();

    const statusMap: Record<string, JobStatusUpdate["status"]> = {
      pending: "queued",
      staged: "queued",
      processing: "processing",
      completed: "completed",
      failed: "failed",
    };

    return {
      status: statusMap[status] ?? "processing",
      output: body.data?.output,
      error: body.data?.error?.message || undefined,
    };
  }

  async getResult(jobId: string): Promise<unknown> {
    const res = await fetch(`${PIAPI_BASE_URL}/api/v1/task/${jobId}`, {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`piapi result fetch failed (${res.status})`);
    }

    const body = (await res.json()) as PiAPIResponse;
    return body.data?.output;
  }

  // ============================================================================
  // High-level convenience methods (same pattern as fal provider)
  // ============================================================================

  /**
   * Generate a video from text with Seedance.
   * For seedance-2-preview, automatically runs watermark removal.
   */
  async textToVideo(args: {
    prompt: string;
    model?: "seedance-2-preview" | "seedance-2-fast-preview";
    duration?: 5 | 10 | 15;
    aspectRatio?: "16:9" | "9:16" | "4:3" | "3:4";
  }) {
    const model = args.model || "seedance-2-preview";

    console.log(`[piapi] starting text-to-video: ${model}`);
    console.log(`[piapi] prompt: ${args.prompt}`);

    return this.runAndWait(model, {
      prompt: args.prompt,
      ...(args.duration != null ? { duration: args.duration } : {}),
      ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
    });
  }

  /**
   * Generate a video from image(s) with Seedance.
   * Use @imageN in the prompt to reference images (e.g. @image1).
   * For seedance-2-preview, automatically runs watermark removal.
   */
  async imageToVideo(args: {
    prompt: string;
    imageUrls: string[];
    model?: "seedance-2-preview" | "seedance-2-fast-preview";
    duration?: 5 | 10 | 15;
    aspectRatio?: "16:9" | "9:16" | "4:3" | "3:4";
  }) {
    const model = args.model || "seedance-2-preview";

    console.log(`[piapi] starting image-to-video: ${model}`);
    console.log(`[piapi] prompt: ${args.prompt}`);
    console.log(`[piapi] images: ${args.imageUrls.length}`);

    return this.runAndWait(model, {
      prompt: args.prompt,
      image_urls: args.imageUrls,
      ...(args.duration != null ? { duration: args.duration } : {}),
      ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
    });
  }

  /**
   * Edit a video with Seedance. The output has the same length as the input.
   * Optionally provide image references for character replacement.
   * For seedance-2-preview, automatically runs watermark removal.
   */
  async editVideo(args: {
    prompt: string;
    videoUrl: string;
    imageUrls?: string[];
    model?: "seedance-2-preview" | "seedance-2-fast-preview";
    aspectRatio?: "16:9" | "9:16" | "4:3" | "3:4";
  }) {
    const model = args.model || "seedance-2-preview";

    console.log(`[piapi] starting video edit: ${model}`);
    console.log(`[piapi] prompt: ${args.prompt}`);

    return this.runAndWait(model, {
      prompt: args.prompt,
      video_urls: [args.videoUrl],
      ...(args.imageUrls?.length ? { image_urls: args.imageUrls } : {}),
      ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
    });
  }

  /**
   * Extend a previously generated video.
   * If prompt/duration/aspect_ratio are omitted, the parent task params are reused.
   */
  async extendVideo(args: {
    parentTaskId: string;
    prompt?: string;
    model?: "seedance-2-preview" | "seedance-2-fast-preview";
    duration?: 5 | 10 | 15;
    aspectRatio?: "16:9" | "9:16" | "4:3" | "3:4";
  }) {
    const model = args.model || "seedance-2-preview";

    console.log(`[piapi] starting extend video: ${model}`);
    console.log(`[piapi] parent task: ${args.parentTaskId}`);

    return this.runAndWait(model, {
      parent_task_id: args.parentTaskId,
      ...(args.prompt ? { prompt: args.prompt } : {}),
      ...(args.duration != null ? { duration: args.duration } : {}),
      ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
    });
  }

  /**
   * Remove watermark from a video.
   */
  async removeWatermark(videoUrl: string) {
    console.log("[piapi] submitting watermark removal...");

    const response = await fetch(`${PIAPI_BASE_URL}/api/v1/task`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "seedance",
        task_type: "remove-watermark",
        input: { video_url: videoUrl },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `piapi watermark removal submit failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as PiAPIResponse;
    const taskId = data.data?.task_id;
    if (!taskId) {
      throw new Error("no task_id in piapi watermark removal response");
    }

    console.log(`[piapi] watermark removal task: ${taskId}`);

    const result = (await this.waitForCompletion(taskId, {
      maxWait: 600000, // 10 minutes max for watermark removal
      pollInterval: 5000,
    })) as { video?: string };

    const videoUrl2 = result?.video;
    if (!videoUrl2) {
      throw new Error("piapi watermark removal completed but no video URL");
    }

    console.log("[piapi] watermark removal completed!");
    return { video: { url: videoUrl2 } };
  }

  // ============================================================================
  // Internal helpers
  // ============================================================================

  /**
   * Submit a task, wait for completion, and auto-remove watermark for seedance-2-preview.
   * Returns the same shape as fal convenience methods.
   */
  private async runAndWait(model: string, input: Record<string, unknown>) {
    const jobId = await this.submit(model, {
      task_type: model,
      ...input,
    });

    const result = (await this.waitForCompletion(jobId, {
      maxWait: this.config.timeout ?? 3600000,
      pollInterval: 10000,
    })) as { video?: string };

    const videoUrl = result?.video;
    if (!videoUrl) {
      throw new Error("piapi task completed but no video URL in output");
    }

    // Auto watermark removal for seedance-2-preview
    if (model === "seedance-2-preview") {
      console.log("[piapi] auto watermark removal for seedance-2-preview...");
      return this.removeWatermark(videoUrl);
    }

    console.log("[piapi] completed!");
    return { video: { url: videoUrl } };
  }
}

// Export singleton instance
export const piapiProvider = new PiAPIProvider();
