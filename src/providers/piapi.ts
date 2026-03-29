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
  // High-level convenience methods
  // ============================================================================

  /**
   * Generate a video with Seedance and wait for completion.
   * For seedance-2-preview, automatically runs watermark removal.
   */
  async generateVideo(options: {
    taskType: string;
    prompt: string;
    duration?: number;
    aspectRatio?: string;
    imageUrls?: string[];
    videoUrls?: string[];
  }): Promise<{ videoUrl: string }> {
    const jobId = await this.submit(options.taskType, {
      task_type: options.taskType,
      prompt: options.prompt,
      ...(options.duration != null ? { duration: options.duration } : {}),
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      ...(options.imageUrls?.length ? { image_urls: options.imageUrls } : {}),
      ...(options.videoUrls?.length ? { video_urls: options.videoUrls } : {}),
    });

    const result = (await this.waitForCompletion(jobId, {
      maxWait: this.config.timeout ?? 3600000,
      pollInterval: 10000,
    })) as { video?: string };

    const videoUrl = result?.video;
    if (!videoUrl) {
      throw new Error("piapi task completed but no video URL in output");
    }

    // For seedance-2-preview, run watermark removal
    if (options.taskType === "seedance-2-preview") {
      const cleanUrl = await this.removeWatermark(videoUrl);
      return { videoUrl: cleanUrl };
    }

    return { videoUrl };
  }

  /**
   * Submit a watermark removal task and wait for it to complete.
   */
  async removeWatermark(videoUrl: string): Promise<string> {
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

    const cleanUrl = result?.video;
    if (!cleanUrl) {
      throw new Error("piapi watermark removal completed but no video URL");
    }

    return cleanUrl;
  }
}

// Export singleton instance
export const piapiProvider = new PiAPIProvider();
