/**
 * UsageTracker - Core class for tracking generation usage and costs
 *
 * Provides:
 * - Session tracking (for a single render)
 * - Daily usage persistence
 * - Limit checking with warnings at 80%
 * - Cost calculation using pricing registry (fetched from provider APIs)
 */

import {
  defaultPricing,
  type PricingResult,
  PricingUnavailableError,
} from "./pricing";
import {
  createEmptyState,
  getTodayDate,
  loadDailyUsage,
  saveDailyUsage,
} from "./storage";
import type {
  DailyLimits,
  DailyUsageState,
  GenerationMetrics,
  GenerationRecord,
  LimitCheckResult,
  ResourceType,
  SessionSummary,
  UsageTrackerOptions,
} from "./types";
import { UsageLimitError } from "./types";

export { PricingUnavailableError };

let idCounter = 0;

function generateId(): string {
  return `gen_${Date.now()}_${++idCounter}`;
}

function calculatePercent(current: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.round((current / limit) * 100);
}

/**
 * Load daily limits from environment variables
 */
export function loadLimitsFromEnv(): DailyLimits {
  const limits: DailyLimits = {};

  const images = process.env.VARG_DAILY_LIMIT_IMAGES;
  if (images !== undefined) {
    const parsed = parseInt(images, 10);
    if (Number.isFinite(parsed)) limits.images = parsed;
  }

  const videos = process.env.VARG_DAILY_LIMIT_VIDEOS;
  if (videos !== undefined) {
    const parsed = parseInt(videos, 10);
    if (Number.isFinite(parsed)) limits.videos = parsed;
  }

  const speechMinutes = process.env.VARG_DAILY_LIMIT_SPEECH_MINUTES;
  if (speechMinutes !== undefined) {
    const parsed = parseFloat(speechMinutes);
    if (Number.isFinite(parsed)) limits.speechMinutes = parsed;
  }

  const musicMinutes = process.env.VARG_DAILY_LIMIT_MUSIC_MINUTES;
  if (musicMinutes !== undefined) {
    const parsed = parseFloat(musicMinutes);
    if (Number.isFinite(parsed)) limits.musicMinutes = parsed;
  }

  const totalCost = process.env.VARG_DAILY_LIMIT_COST;
  if (totalCost !== undefined) {
    const parsed = parseFloat(totalCost);
    if (Number.isFinite(parsed)) limits.totalCost = parsed;
  }

  const resetHour = process.env.VARG_DAILY_RESET_HOUR_UTC;
  if (resetHour !== undefined) {
    const parsed = parseInt(resetHour, 10);
    if (Number.isFinite(parsed)) limits.resetHourUTC = parsed;
  }

  return limits;
}

/**
 * Check if usage tracking is enabled
 */
function parseEnvBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  return undefined;
}

export function isTrackingEnabled(): boolean {
  const primary = parseEnvBool(process.env.VARG_TRACK_USAGE);
  if (primary !== undefined) return primary;
  const legacy = parseEnvBool(process.env.VARG_USAGE_TRACKING);
  if (legacy !== undefined) return legacy;
  // Enabled by default if unset or unrecognized
  return true;
}

/**
 * Get usage directory from env or default
 */
export function getUsageDir(): string {
  return process.env.VARG_USAGE_DIR ?? ".cache/usage";
}

/**
 * UsageTracker class - tracks generation usage for a render session
 */
export class UsageTracker {
  private dailyState: DailyUsageState;
  private sessionRecords: GenerationRecord[] = [];
  private limits: DailyLimits;
  private usageDir: string;
  private loaded = false;
  private dirty = false;
  private enabled: boolean;
  private pricingErrors: PricingUnavailableError[] = [];
  private pricingErrorShown = false;

  private onGeneration?: (record: GenerationRecord) => void;
  private onLimitWarning?: (result: LimitCheckResult) => void;

  constructor(options: UsageTrackerOptions = {}) {
    this.limits = options.limits ?? loadLimitsFromEnv();
    this.usageDir = options.usageDir ?? getUsageDir();
    this.enabled = options.enabled ?? isTrackingEnabled();
    this.onGeneration = options.onGeneration;
    this.onLimitWarning = options.onLimitWarning;

    const date = getTodayDate(this.limits.resetHourUTC);
    this.dailyState = createEmptyState(date);
  }

  /**
   * Load daily usage state from disk
   */
  async load(): Promise<void> {
    if (!this.enabled || this.loaded) return;

    const date = getTodayDate(this.limits.resetHourUTC);
    this.dailyState = await loadDailyUsage(date, this.usageDir);
    this.loaded = true;
  }

  /**
   * Save daily usage state to disk
   */
  async save(): Promise<void> {
    if (!this.enabled || !this.dirty) return;
    await saveDailyUsage(this.dailyState, this.usageDir);
    this.dirty = false;
  }

  /**
   * Check if a generation is allowed within configured limits
   * @param resourceType - Type of resource to generate
   * @param estimatedCost - Estimated cost for this generation
   * @param durationSeconds - Duration for video/audio (optional)
   */
  checkLimits(
    resourceType: ResourceType,
    estimatedCost = 0,
    durationSeconds?: number,
  ): LimitCheckResult {
    if (!this.enabled) {
      return { allowed: true };
    }

    const { limits, dailyState } = this;

    // Check type-specific limits
    if (resourceType === "image" && limits.images !== undefined) {
      const current = dailyState.images;
      const percent = calculatePercent(current, limits.images);

      if (current >= limits.images) {
        return {
          allowed: false,
          limitType: "images",
          current,
          limit: limits.images,
          percent,
        };
      }
      if (percent >= 80) {
        const result: LimitCheckResult = {
          allowed: true,
          limitType: "images",
          current,
          limit: limits.images,
          percent,
          isWarning: true,
        };
        this.onLimitWarning?.(result);
        return result;
      }
    }

    if (resourceType === "video" && limits.videos !== undefined) {
      const current = dailyState.videos;
      const percent = calculatePercent(current, limits.videos);

      if (current >= limits.videos) {
        return {
          allowed: false,
          limitType: "videos",
          current,
          limit: limits.videos,
          percent,
        };
      }
      if (percent >= 80) {
        const result: LimitCheckResult = {
          allowed: true,
          limitType: "videos",
          current,
          limit: limits.videos,
          percent,
          isWarning: true,
        };
        this.onLimitWarning?.(result);
        return result;
      }
    }

    if (resourceType === "speech" && limits.speechMinutes !== undefined) {
      const current = dailyState.speechMinutes;
      const added = (durationSeconds ?? 30) / 60;
      const percent = calculatePercent(current, limits.speechMinutes);

      if (current + added > limits.speechMinutes) {
        return {
          allowed: false,
          limitType: "speechMinutes",
          current,
          limit: limits.speechMinutes,
          percent,
        };
      }
      if (percent >= 80) {
        const result: LimitCheckResult = {
          allowed: true,
          limitType: "speechMinutes",
          current,
          limit: limits.speechMinutes,
          percent,
          isWarning: true,
        };
        this.onLimitWarning?.(result);
        return result;
      }
    }

    if (resourceType === "music" && limits.musicMinutes !== undefined) {
      const current = dailyState.musicMinutes;
      const added = (durationSeconds ?? 30) / 60;
      const percent = calculatePercent(current, limits.musicMinutes);

      if (current + added > limits.musicMinutes) {
        return {
          allowed: false,
          limitType: "musicMinutes",
          current,
          limit: limits.musicMinutes,
          percent,
        };
      }
      if (percent >= 80) {
        const result: LimitCheckResult = {
          allowed: true,
          limitType: "musicMinutes",
          current,
          limit: limits.musicMinutes,
          percent,
          isWarning: true,
        };
        this.onLimitWarning?.(result);
        return result;
      }
    }

    // Check total cost limit
    if (limits.totalCost !== undefined) {
      const current = dailyState.totalCost;
      const percent = calculatePercent(current, limits.totalCost);

      if (limits.totalCost <= 0) {
        return {
          allowed: false,
          limitType: "totalCost",
          current,
          limit: limits.totalCost,
          percent,
        };
      }

      if (current + estimatedCost > limits.totalCost) {
        return {
          allowed: false,
          limitType: "totalCost",
          current,
          limit: limits.totalCost,
          percent,
        };
      }
      if (percent >= 80) {
        const result: LimitCheckResult = {
          allowed: true,
          limitType: "totalCost",
          current,
          limit: limits.totalCost,
          percent,
          isWarning: true,
        };
        this.onLimitWarning?.(result);
        return result;
      }
    }

    return { allowed: true };
  }

  /**
   * Throw if limits are exceeded (convenience method)
   */
  assertLimits(
    resourceType: ResourceType,
    estimatedCost = 0,
    durationSeconds?: number,
  ): void {
    const result = this.checkLimits(
      resourceType,
      estimatedCost,
      durationSeconds,
    );
    if (!result.allowed) {
      throw new UsageLimitError(
        result.limitType!,
        result.current!,
        result.limit!,
      );
    }
  }

  /**
   * Record a generation event (async - fetches pricing from API)
   */
  async record(
    metrics: GenerationMetrics & {
      cached: boolean;
      prompt?: string;
    },
  ): Promise<GenerationRecord> {
    const {
      provider,
      modelId,
      resourceType,
      cached,
      prompt,
      durationSeconds,
      requestId,
      count = 1,
    } = metrics;

    // Calculate cost (0 for cached, fetch from API for new generations)
    let estimatedCost = 0;
    if (!cached) {
      const pricingResult = await defaultPricing.calculateCost(metrics);
      if (pricingResult.error) {
        this.addPricingError(pricingResult.error);
      }
      estimatedCost = pricingResult.cost ?? 0;
    }

    const record: GenerationRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      provider,
      modelId,
      resourceType,
      estimatedCost,
      cached,
      count,
      requestId,
      durationSeconds,
      prompt: prompt ? prompt.slice(0, 100) : undefined,
    };

    // Always add to session records
    this.sessionRecords.push(record);

    // Update daily state if not cached and tracking is enabled
    if (!cached && this.enabled) {
      this.dailyState.generations.push(record);
      this.dailyState.totalCost += estimatedCost;

      switch (resourceType) {
        case "image":
          this.dailyState.images += count;
          break;
        case "video":
          this.dailyState.videos += count;
          this.dailyState.videoSeconds += (durationSeconds ?? 5) * count;
          break;
        case "speech":
          this.dailyState.speechMinutes +=
            ((durationSeconds ?? 30) / 60) * count;
          break;
        case "music":
          this.dailyState.musicMinutes +=
            ((durationSeconds ?? 30) / 60) * count;
          break;
      }

      this.dirty = true;
    }

    // Call callback
    this.onGeneration?.(record);

    return record;
  }

  /**
   * Add a pricing error (for tracking and display)
   */
  private addPricingError(error: PricingUnavailableError): void {
    // Only add unique errors (by provider)
    const exists = this.pricingErrors.some(
      (e) => e.provider === error.provider,
    );
    if (!exists) {
      this.pricingErrors.push(error);
    }
  }

  /**
   * Get pricing errors that occurred during this session
   */
  getPricingErrors(): PricingUnavailableError[] {
    return [...this.pricingErrors];
  }

  /**
   * Check if there are unshown pricing errors
   */
  hasPricingErrors(): boolean {
    return this.pricingErrors.length > 0 && !this.pricingErrorShown;
  }

  /**
   * Mark pricing errors as shown
   */
  markPricingErrorsShown(): void {
    this.pricingErrorShown = true;
  }

  /**
   * Get a formatted warning message for pricing errors
   */
  getPricingWarningMessage(): string | undefined {
    if (this.pricingErrors.length === 0) {
      return undefined;
    }

    const providers = this.pricingErrors.map((e) => e.provider).join(", ");
    const reasons = this.pricingErrors
      .map((e) => `  - ${e.provider}: ${e.reason}`)
      .join("\n");

    return (
      `⚠️  Pricing unavailable from: ${providers}\n` +
      `${reasons}\n` +
      `Cost tracking is disabled. Proceed based on your own usage intuition.`
    );
  }

  /**
   * Get session summary for this render (async - may fetch prices for cache savings)
   */
  async getSessionSummary(): Promise<SessionSummary> {
    const records = this.sessionRecords;

    const createResourceUsage = (type: ResourceType) => {
      const typeRecords = records.filter((r) => r.resourceType === type);
      const generated = typeRecords.filter((r) => !r.cached);
      const cached = typeRecords.filter((r) => r.cached);

      return {
        generated: generated.reduce((sum, r) => sum + (r.count ?? 1), 0),
        cached: cached.reduce((sum, r) => sum + (r.count ?? 1), 0),
        cost: generated.reduce((sum, r) => sum + r.estimatedCost, 0),
        duration:
          type === "video"
            ? generated.reduce(
                (sum, r) => sum + (r.durationSeconds ?? 0) * (r.count ?? 1),
                0,
              )
            : type === "speech" || type === "music"
              ? generated.reduce(
                  (sum, r) =>
                    sum + ((r.durationSeconds ?? 0) / 60) * (r.count ?? 1),
                  0,
                )
              : undefined,
      };
    };

    const images = createResourceUsage("image");
    const videos = createResourceUsage("video");
    const speech = createResourceUsage("speech");
    const music = createResourceUsage("music");

    const totalCost = images.cost + videos.cost + speech.cost + music.cost;

    // Calculate what we would have paid without cache
    const cachedRecords = records.filter((r) => r.cached);
    let savedFromCache = 0;

    for (const r of cachedRecords) {
      const itemCount = r.count ?? 1;
      const result = await defaultPricing.calculateCost({
        provider: r.provider,
        modelId: r.modelId,
        resourceType: r.resourceType,
        count: itemCount,
        durationSeconds: r.durationSeconds,
      });
      if (result.cost !== undefined) {
        savedFromCache += result.cost;
      }
    }

    return {
      images,
      videos,
      speech,
      music,
      totalCost,
      totalCount: records.length,
      savedFromCache,
    };
  }

  /**
   * Get daily usage state
   */
  getDailyState(): DailyUsageState {
    return this.dailyState;
  }

  /**
   * Get configured limits
   */
  getLimits(): DailyLimits {
    return this.limits;
  }

  /**
   * Check if any limits are configured
   */
  hasLimits(): boolean {
    const { limits } = this;
    return (
      limits.images !== undefined ||
      limits.videos !== undefined ||
      limits.speechMinutes !== undefined ||
      limits.musicMinutes !== undefined ||
      limits.totalCost !== undefined
    );
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get session records (for debugging/testing)
   */
  getSessionRecords(): GenerationRecord[] {
    return [...this.sessionRecords];
  }
}

/**
 * Create and initialize a usage tracker
 */
export async function createUsageTracker(
  options?: UsageTrackerOptions,
): Promise<UsageTracker> {
  const tracker = new UsageTracker(options);
  await tracker.load();
  return tracker;
}
