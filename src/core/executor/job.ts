/**
 * Job State Machine
 * Manages job lifecycle: queued -> processing -> completed/failed
 */

import type {
  ExecutionResult,
  Job,
  JobStatus,
  JobStatusUpdate,
  Provider,
  RunOptions,
} from "../schema/types";

export interface JobConfig {
  provider: Provider;
  model: string;
  inputs: Record<string, unknown>;
  options?: RunOptions;
}

export class JobRunner {
  private jobs = new Map<string, Job>();
  private pollInterval = 2000; // Start with 2s
  private maxPollInterval = 10000; // Cap at 10s

  /**
   * Create and run a job
   */
  async run(config: JobConfig): Promise<ExecutionResult> {
    const { provider, model, inputs, options } = config;
    const startTime = Date.now();

    // Create job record
    const job: Job = {
      id: "",
      status: "pending",
      provider: provider.name,
      model,
      inputs,
      createdAt: new Date(),
      updatedAt: new Date(),
      logs: [],
    };

    try {
      // Submit to provider
      job.status = "queued";
      job.id = await provider.submit(model, inputs);
      this.jobs.set(job.id, job);

      if (options?.onStatusChange) {
        options.onStatusChange("queued");
      }

      // If not waiting, return immediately
      if (options?.wait === false) {
        return {
          output: { jobId: job.id },
          duration: Date.now() - startTime,
          provider: provider.name,
          model,
          jobId: job.id,
        };
      }

      // Poll for completion
      const result = await this.waitForCompletion(job, provider, options);

      // Update job record
      job.status = "completed";
      job.output = result;
      job.completedAt = new Date();
      job.updatedAt = new Date();

      const duration = Date.now() - startTime;

      return {
        output: result as string | Record<string, unknown>,
        duration,
        provider: provider.name,
        model,
        jobId: job.id,
      };
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date();

      if (options?.onStatusChange) {
        options.onStatusChange("failed");
      }

      throw error;
    }
  }

  /**
   * Wait for a job to complete with polling
   */
  private async waitForCompletion(
    job: Job,
    provider: Provider,
    options?: RunOptions,
  ): Promise<unknown> {
    const timeout = options?.timeout ?? 300000; // 5 minutes default
    const startTime = Date.now();
    let currentInterval = this.pollInterval;

    while (Date.now() - startTime < timeout) {
      const status = await provider.getStatus(job.id);

      // Update job record
      job.status = this.mapStatus(status.status);
      job.updatedAt = new Date();

      if (status.progress !== undefined) {
        job.progress = status.progress;
      }

      if (status.logs) {
        job.logs = [...(job.logs || []), ...status.logs];
      }

      // Notify progress
      if (options?.onProgress && status.progress !== undefined) {
        options.onProgress(status.progress, status.logs);
      }

      if (options?.onStatusChange) {
        options.onStatusChange(job.status);
      }

      // Check terminal states
      if (status.status === "completed") {
        return status.output ?? (await provider.getResult(job.id));
      }

      if (status.status === "failed") {
        throw new Error(status.error ?? "Job failed");
      }

      if (status.status === "cancelled") {
        throw new Error("Job was cancelled");
      }

      // Wait with exponential backoff
      await this.sleep(currentInterval);
      currentInterval = Math.min(currentInterval * 1.5, this.maxPollInterval);
    }

    throw new Error(`Job ${job.id} timed out after ${timeout}ms`);
  }

  /**
   * Map provider status to our status
   */
  private mapStatus(status: JobStatusUpdate["status"]): JobStatus {
    return status;
  }

  /**
   * Get a job by ID
   */
  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string, provider: Provider): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (provider.cancel) {
      await provider.cancel(jobId);
    }

    job.status = "cancelled";
    job.updatedAt = new Date();
  }

  /**
   * List all jobs
   */
  list(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        this.jobs.delete(id);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global job runner instance
export const jobRunner = new JobRunner();
