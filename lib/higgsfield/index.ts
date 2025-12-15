#!/usr/bin/env bun
/**
 * Higgsfield API client using HTTP requests
 * Base client for all Higgsfield models
 */

const BASE_URL = "https://platform.higgsfield.ai";

export interface HiggsfieldConfig {
  apiKey?: string;
  apiSecret?: string;
}

export type RequestStatus =
  | "queued"
  | "in_progress"
  | "nsfw"
  | "failed"
  | "completed"
  | "canceled";

export interface GenerationRequest {
  status: RequestStatus;
  request_id: string;
  status_url: string;
  cancel_url: string;
}

export interface CompletedRequest extends GenerationRequest {
  status: "completed";
  images?: Array<{ url: string }>;
  video?: { url: string };
}

export interface FailedRequest extends GenerationRequest {
  status: "failed";
  error: string;
}

export interface GenerationResponse {
  status: RequestStatus;
  request_id: string;
  status_url: string;
  cancel_url: string;
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: string;
}

export class HiggsfieldClient {
  private apiKey: string;
  private apiSecret: string;

  constructor(config?: HiggsfieldConfig) {
    this.apiKey =
      config?.apiKey ||
      process.env.HIGGSFIELD_API_KEY ||
      process.env.HF_API_KEY ||
      "";
    this.apiSecret =
      config?.apiSecret ||
      process.env.HIGGSFIELD_SECRET ||
      process.env.HF_API_SECRET ||
      "";

    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        "Higgsfield API credentials not found. Set HIGGSFIELD_API_KEY and HIGGSFIELD_SECRET environment variables.",
      );
    }
  }

  private getAuthHeader(): string {
    return `Key ${this.apiKey}:${this.apiSecret}`;
  }

  /**
   * Submit a generation request to the queue
   */
  async submitRequest<T>(
    modelId: string,
    params: T,
    webhook?: string,
  ): Promise<GenerationResponse> {
    const url = webhook
      ? `${BASE_URL}/${modelId}?hf_webhook=${encodeURIComponent(webhook)}`
      : `${BASE_URL}/${modelId}`;

    console.log(`[higgsfield] submitting request to ${modelId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Higgsfield API error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as GenerationResponse;
    console.log(`[higgsfield] request queued: ${data.request_id}`);
    return data;
  }

  /**
   * Get the status of a generation request
   */
  async getStatus(requestId: string): Promise<GenerationResponse> {
    const url = `${BASE_URL}/requests/${requestId}/status`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.getAuthHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Higgsfield API error (${response.status}): ${errorText}`,
      );
    }

    return (await response.json()) as GenerationResponse;
  }

  /**
   * Cancel a pending request (only works in "queued" status)
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const url = `${BASE_URL}/requests/${requestId}/cancel`;

    console.log(`[higgsfield] canceling request: ${requestId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    if (response.status === 202) {
      console.log(`[higgsfield] request canceled successfully`);
      return true;
    }

    if (response.status === 400) {
      console.log(
        `[higgsfield] request cannot be canceled (already processing)`,
      );
      return false;
    }

    const errorText = await response.text();
    throw new Error(`Higgsfield API error (${response.status}): ${errorText}`);
  }

  /**
   * Wait for a request to complete with polling
   */
  async waitForCompletion(
    requestId: string,
    options: {
      pollingInterval?: number;
      maxWaitTime?: number;
      onUpdate?: (status: GenerationResponse) => void;
    } = {},
  ): Promise<GenerationResponse> {
    const pollingInterval = options.pollingInterval || 2000; // 2 seconds
    const maxWaitTime = options.maxWaitTime || 300000; // 5 minutes
    const startTime = Date.now();

    while (true) {
      const status = await this.getStatus(requestId);

      if (options.onUpdate) {
        options.onUpdate(status);
      }

      // Check if completed, failed, or nsfw
      if (
        status.status === "completed" ||
        status.status === "failed" ||
        status.status === "nsfw" ||
        status.status === "canceled"
      ) {
        return status;
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(
          `Request timeout after ${maxWaitTime}ms. Request ID: ${requestId}`,
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }
  }

  /**
   * Submit and wait for completion in one call
   */
  async generate<T>(
    modelId: string,
    params: T,
    options: {
      webhook?: string;
      pollingInterval?: number;
      maxWaitTime?: number;
      onUpdate?: (status: GenerationResponse) => void;
    } = {},
  ): Promise<GenerationResponse> {
    const request = await this.submitRequest(modelId, params, options.webhook);

    // If webhook is provided, return immediately
    if (options.webhook) {
      console.log(`[higgsfield] webhook configured, returning request info`);
      return request;
    }

    // Otherwise, wait for completion
    return await this.waitForCompletion(request.request_id, {
      pollingInterval: options.pollingInterval,
      maxWaitTime: options.maxWaitTime,
      onUpdate: options.onUpdate,
    });
  }
}

export default HiggsfieldClient;
