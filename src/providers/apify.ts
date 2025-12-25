/**
 * Apify provider for running actors and web scraping
 * Supports TikTok scraping, web scraping, and other Apify actors
 */

import { ApifyClient } from "apify-client";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export interface ApifyProviderConfig extends ProviderConfig {
  /** Apify API token (defaults to APIFY_TOKEN env var) */
  token?: string;
}

export interface RunActorOptions {
  /** Actor ID in format "username/actor-name" */
  actorId: string;
  /** Input parameters for the actor */
  input?: Record<string, unknown>;
  /** Whether to wait for the actor to finish (default: true) */
  waitForFinish?: boolean;
}

export interface ApifyRunResult {
  /** Run ID */
  runId: string;
  /** Dataset ID containing results */
  datasetId: string;
  /** Run status */
  status: string;
  /** Result items (if waitForFinish was true) */
  items?: unknown[];
}

export class ApifyProvider extends BaseProvider {
  readonly name = "apify";
  private client: ApifyClient;

  constructor(config?: ApifyProviderConfig) {
    super(config);
    this.client = new ApifyClient({
      token: config?.token || process.env.APIFY_TOKEN,
    });
  }

  /**
   * Submit an actor run job
   * @param model - Actor ID (e.g., "clockworks/tiktok-scraper")
   * @param inputs - Actor input parameters
   */
  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    console.log(`[apify] submitting actor: ${model}`);

    const actor = this.client.actor(model);
    const run = await actor.start(inputs);

    console.log(`[apify] run started: ${run.id}`);
    return run.id;
  }

  /**
   * Get the status of an actor run
   */
  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const run = await this.client.run(jobId).get();

    if (!run) {
      return { status: "failed", error: "Run not found" };
    }

    const statusMap: Record<string, JobStatusUpdate["status"]> = {
      READY: "queued",
      RUNNING: "processing",
      SUCCEEDED: "completed",
      FAILED: "failed",
      ABORTED: "cancelled",
      ABORTING: "cancelled",
      TIMED_OUT: "failed",
    };

    return {
      status: statusMap[run.status] ?? "processing",
      output: run.defaultDatasetId,
      error: run.status === "FAILED" ? "Actor run failed" : undefined,
    };
  }

  /**
   * Get the results of a completed actor run
   */
  async getResult(jobId: string): Promise<unknown> {
    const run = await this.client.run(jobId).get();

    if (!run?.defaultDatasetId) {
      throw new Error("Run not found or has no dataset");
    }

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();
    return items;
  }

  /**
   * Cancel a running actor
   */
  override async cancel(jobId: string): Promise<void> {
    await this.client.run(jobId).abort();
    console.log(`[apify] run aborted: ${jobId}`);
  }

  // ============================================================================
  // High-level convenience methods
  // ============================================================================

  /**
   * Run an actor and optionally wait for results
   */
  async runActor(options: RunActorOptions): Promise<ApifyRunResult> {
    console.log(`[apify] running actor: ${options.actorId}`);

    const actor = this.client.actor(options.actorId);

    if (options.waitForFinish !== false) {
      // call() waits for the run to finish
      const run = await actor.call(options.input);
      console.log(`[apify] run completed: ${run.id}`);

      // Get results from dataset
      const { items } = await this.client
        .dataset(run.defaultDatasetId)
        .listItems();
      console.log(`[apify] retrieved ${items.length} items`);

      return {
        runId: run.id,
        datasetId: run.defaultDatasetId,
        status: run.status,
        items,
      };
    }

    // start() returns immediately
    const run = await actor.start(options.input);
    console.log(`[apify] run started: ${run.id}`);

    return {
      runId: run.id,
      datasetId: run.defaultDatasetId,
      status: run.status,
    };
  }

  /**
   * Get items from a dataset
   */
  async getDataset(datasetId: string): Promise<unknown[]> {
    console.log(`[apify] fetching dataset: ${datasetId}`);
    const { items } = await this.client.dataset(datasetId).listItems();
    console.log(`[apify] retrieved ${items.length} items`);
    return items;
  }

  /**
   * Get run info
   */
  async getRunInfo(runId: string) {
    console.log(`[apify] fetching run info: ${runId}`);
    const run = await this.client.run(runId).get();
    return run;
  }

  /**
   * Wait for a run to finish
   */
  async waitForRun(runId: string) {
    console.log(`[apify] waiting for run: ${runId}`);
    const run = await this.client.run(runId).waitForFinish();
    console.log(`[apify] run finished with status: ${run?.status}`);
    return run;
  }

  /**
   * Get value from key-value store
   */
  async getKeyValueStoreValue(storeId: string, key: string) {
    console.log(`[apify] fetching key "${key}" from store: ${storeId}`);
    const value = await this.client.keyValueStore(storeId).getRecord(key);
    return value;
  }

  /**
   * Download videos from scraped results using yt-dlp
   */
  async downloadVideos(
    items: Array<{ webVideoUrl?: string }>,
    outputDir = "output/videos",
  ): Promise<string[]> {
    const urls = items
      .map((item) => item.webVideoUrl)
      .filter((url): url is string => !!url);

    console.log(`[apify] downloading ${urls.length} videos`);

    // Create download dir if needed
    await Bun.$`mkdir -p ${outputDir}`;

    const downloaded: string[] = [];

    for (const url of urls) {
      console.log(`[apify] downloading: ${url}`);
      try {
        await Bun.$`yt-dlp -o "${outputDir}/%(id)s.%(ext)s" ${url}`;
        downloaded.push(url);
        console.log(`[apify] downloaded successfully`);
      } catch (err) {
        console.error(`[apify] failed to download ${url}:`, err);
      }
    }

    console.log(`[apify] all downloads complete. saved to: ${outputDir}`);
    return downloaded;
  }
}

// Popular actors registry
export const ACTORS = {
  TIKTOK: {
    SCRAPER: "clockworks/tiktok-scraper",
    HASHTAG: "clockworks/tiktok-hashtag-scraper",
    PROFILE: "clockworks/tiktok-profile-scraper",
  },
  WEB: {
    SCRAPER: "apify/web-scraper",
    CHEERIO: "apify/cheerio-scraper",
    PUPPETEER: "apify/puppeteer-scraper",
  },
  SOCIAL: {
    INSTAGRAM: "apify/instagram-scraper",
    TWITTER: "apify/twitter-scraper",
    YOUTUBE: "bernardo/youtube-scraper",
  },
};

// Export singleton instance
export const apifyProvider = new ApifyProvider();

// Export convenience functions
export const runActor = (options: RunActorOptions) =>
  apifyProvider.runActor(options);

export const getDataset = (datasetId: string) =>
  apifyProvider.getDataset(datasetId);

export const getRunInfo = (runId: string) => apifyProvider.getRunInfo(runId);

export const waitForRun = (runId: string) => apifyProvider.waitForRun(runId);

export const getKeyValueStoreValue = (storeId: string, key: string) =>
  apifyProvider.getKeyValueStoreValue(storeId, key);

export const downloadVideos = (
  items: Array<{ webVideoUrl?: string }>,
  outputDir?: string,
) => apifyProvider.downloadVideos(items, outputDir);
