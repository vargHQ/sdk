/**
 * Replicate provider for video and image generation
 * Supports Minimax, Kling, Luma, Flux, and other models
 */

import Replicate from "replicate";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export class ReplicateProvider extends BaseProvider {
  readonly name = "replicate";
  private client: Replicate;

  constructor(config?: ProviderConfig) {
    super(config);
    this.client = new Replicate({
      auth: config?.apiKey || process.env.REPLICATE_API_TOKEN || "",
    });
  }

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    // Transform inputs for provider-specific field names
    const transformedInputs = this.transformInputs(model, inputs);

    const prediction = await this.client.predictions.create({
      model: model as `${string}/${string}`,
      input: transformedInputs,
    });

    console.log(`[replicate] job submitted: ${prediction.id}`);
    return prediction.id;
  }

  /**
   * Transform inputs for provider-specific field names
   */
  private transformInputs(
    model: string,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    // Nano Banana Pro: Replicate uses 'image_input' instead of 'image_urls'
    if (model === "google/nano-banana-pro" && inputs.image_urls) {
      const { image_urls, ...rest } = inputs;
      return {
        ...rest,
        image_input: image_urls,
      };
    }
    return inputs;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const prediction = await this.client.predictions.get(jobId);

    const statusMap: Record<string, JobStatusUpdate["status"]> = {
      starting: "queued",
      processing: "processing",
      succeeded: "completed",
      failed: "failed",
      canceled: "cancelled",
    };

    return {
      status: statusMap[prediction.status] ?? "processing",
      output: prediction.output,
      error:
        typeof prediction.error === "string" ? prediction.error : undefined,
    };
  }

  async getResult(jobId: string): Promise<unknown> {
    const prediction = await this.client.predictions.get(jobId);
    return prediction.output;
  }

  override async cancel(jobId: string): Promise<void> {
    await this.client.predictions.cancel(jobId);
  }

  // ============================================================================
  // High-level convenience methods
  // ============================================================================

  async runModel(model: string, input: Record<string, unknown>) {
    console.log(`[replicate] running ${model}...`);

    const output = await this.client.run(model as `${string}/${string}`, {
      input,
    });

    console.log(`[replicate] completed`);
    return output;
  }

  async runVideo(options: { model: string; input: Record<string, unknown> }) {
    return this.runModel(options.model, options.input);
  }

  async runImage(options: { model: string; input: Record<string, unknown> }) {
    return this.runModel(options.model, options.input);
  }

  async listPredictions() {
    return this.client.predictions.list();
  }

  async getPrediction(id: string) {
    return this.client.predictions.get(id);
  }
}

// Popular models registry
export const MODELS = {
  VIDEO: {
    MINIMAX: "minimax/video-01",
    KLING: "fofr/kling-v1.5",
    LUMA: "fofr/ltx-video",
    RUNWAY_GEN3: "replicate/runway-gen3-turbo",
    WAN_2_5: "wan-video/wan-2.5-i2v",
  },
  IMAGE: {
    FLUX_PRO: "black-forest-labs/flux-1.1-pro",
    FLUX_DEV: "black-forest-labs/flux-dev",
    FLUX_SCHNELL: "black-forest-labs/flux-schnell",
    STABLE_DIFFUSION: "stability-ai/sdxl",
    NANO_BANANA_PRO: "google/nano-banana-pro",
  },
};

// Export singleton instance
export const replicateProvider = new ReplicateProvider();

// Re-export convenience functions for backward compatibility
export const runModel = (model: string, input: Record<string, unknown>) =>
  replicateProvider.runModel(model, input);
export const runVideo = (options: {
  model: string;
  input: Record<string, unknown>;
}) => replicateProvider.runVideo(options);
export const runImage = (options: {
  model: string;
  input: Record<string, unknown>;
}) => replicateProvider.runImage(options);
