/**
 * Base provider interface and abstract class
 * All providers implement this interface for consistent execution
 */

import type {
  JobStatusUpdate,
  Provider,
  ProviderConfig,
} from "../core/schema/types";

/**
 * Abstract base class for providers
 * Provides common functionality and enforces the Provider interface
 */
export abstract class BaseProvider implements Provider {
  abstract readonly name: string;

  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 300000, // 5 minutes default
      retries: 3,
      ...config,
    };
  }

  /**
   * Submit a job to the provider
   */
  abstract submit(
    model: string,
    inputs: Record<string, unknown>,
    config?: ProviderConfig,
  ): Promise<string>;

  /**
   * Get the current status of a job
   */
  abstract getStatus(jobId: string): Promise<JobStatusUpdate>;

  /**
   * Get the result of a completed job
   */
  abstract getResult(jobId: string): Promise<unknown>;

  /**
   * Optional: Cancel a running job
   */
  async cancel?(jobId: string): Promise<void>;

  /**
   * Optional: Upload a file to the provider's storage
   */
  async uploadFile?(
    file: File | Blob | ArrayBuffer,
    filename?: string,
  ): Promise<string>;

  /**
   * Helper: Wait for a job to complete with polling
   */
  protected async waitForCompletion(
    jobId: string,
    options: {
      maxWait?: number;
      pollInterval?: number;
      onProgress?: (progress: number, logs?: string[]) => void;
    } = {},
  ): Promise<unknown> {
    const { maxWait = this.config.timeout ?? 300000, pollInterval = 2000 } =
      options;
    const startTime = Date.now();
    let currentInterval = pollInterval;

    while (Date.now() - startTime < maxWait) {
      const status = await this.getStatus(jobId);

      if (options.onProgress && status.progress !== undefined) {
        options.onProgress(status.progress, status.logs);
      }

      if (status.status === "completed") {
        return status.output ?? (await this.getResult(jobId));
      }

      if (status.status === "failed") {
        throw new Error(status.error ?? "Job failed");
      }

      if (status.status === "cancelled") {
        throw new Error("Job was cancelled");
      }

      // Exponential backoff with cap
      await this.sleep(currentInterval);
      currentInterval = Math.min(currentInterval * 1.5, 10000);
    }

    throw new Error(`Job ${jobId} timed out after ${maxWait}ms`);
  }

  /**
   * Helper: Sleep for a duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Retry a function with exponential backoff
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    options: { retries?: number; delay?: number } = {},
  ): Promise<T> {
    const { retries = this.config.retries ?? 3, delay = 1000 } = options;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          await this.sleep(delay * 2 ** attempt);
        }
      }
    }

    throw lastError;
  }
}

/**
 * Provider registry for managing multiple providers
 */
export class ProviderRegistry {
  private providers = new Map<string, Provider>();

  /**
   * Register a provider
   */
  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a provider by name
   */
  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a provider exists
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get all registered providers
   */
  all(): Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider names
   */
  names(): string[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Global provider registry instance
 */
export const providers = new ProviderRegistry();

/**
 * Helper type for provider-specific result structures
 */
export interface ProviderResult<T = unknown> {
  data: T;
  requestId?: string;
  timing?: {
    queueTime?: number;
    processingTime?: number;
    totalTime?: number;
  };
}

/**
 * Helper: Ensure a path is a URL (upload local files if needed)
 */
export async function ensureUrl(
  pathOrUrl: string,
  uploader: (file: ArrayBuffer) => Promise<string>,
): Promise<string> {
  // Already a URL
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  // Local file - read and upload
  const file = Bun.file(pathOrUrl);
  if (!(await file.exists())) {
    throw new Error(`Local file not found: ${pathOrUrl}`);
  }

  const buffer = await file.arrayBuffer();
  return uploader(buffer);
}

/**
 * Helper: Download a URL to a local file
 */
export async function downloadToFile(
  url: string,
  outputPath: string,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(outputPath, buffer);
  return outputPath;
}

/**
 * Helper: Get file extension from URL or content type
 */
export function getExtension(url: string, contentType?: string): string {
  // Try to get from URL
  const urlPath = new URL(url).pathname;
  const urlExt = urlPath.split(".").pop();
  if (urlExt && urlExt.length <= 4) {
    return urlExt;
  }

  // Try content type
  if (contentType) {
    const typeMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };
    return typeMap[contentType] ?? "bin";
  }

  return "bin";
}
