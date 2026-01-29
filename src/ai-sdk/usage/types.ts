/**
 * Usage tracking types for the varg SDK
 * Provides cost estimation, daily limits, and usage persistence
 */

/**
 * Supported AI providers
 */
export type UsageProvider =
  | "fal"
  | "elevenlabs"
  | "openai"
  | "replicate"
  | "google";

/**
 * Types of resources that can be generated
 */
export type ResourceType = "image" | "video" | "speech" | "music";

/**
 * Pricing unit types
 */
export type PricingUnit = "image" | "second" | "minute" | "1k_chars";

/**
 * Price information for a model
 */
export interface PriceInfo {
  unit: PricingUnit;
  price: number;
}

/**
 * Metrics extracted from a generation for cost calculation
 */
export interface GenerationMetrics {
  provider: UsageProvider;
  modelId: string;
  resourceType: ResourceType;
  /** Number of items generated (for images) */
  count?: number;
  /** Duration in seconds (for video/audio, from API response) */
  durationSeconds?: number;
  /** Character count (for speech) */
  characterCount?: number;
  /** Request ID from provider (for tracking/audit) */
  requestId?: string;
}

/**
 * Record of a single generation event
 */
export interface GenerationRecord {
  /** Unique identifier for this generation */
  id: string;
  /** ISO timestamp of when generation occurred */
  timestamp: string;
  /** Provider that performed the generation */
  provider: UsageProvider;
  /** Model ID used for generation */
  modelId: string;
  /** Type of resource generated */
  resourceType: ResourceType;
  /** Estimated cost in USD (total for all items in this record) */
  estimatedCost: number;
  /** Whether this was served from cache */
  cached: boolean;
  /** Number of items generated (default 1) */
  count?: number;
  /** Request ID from provider */
  requestId?: string;
  /** Duration in seconds (for video/audio) */
  durationSeconds?: number;
  /** Prompt used (truncated for privacy) */
  prompt?: string;
}

/**
 * Aggregated daily usage state (persisted to disk)
 */
export interface DailyUsageState {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Number of images generated (not cached) */
  images: number;
  /** Number of videos generated (not cached) */
  videos: number;
  /** Total video seconds generated */
  videoSeconds: number;
  /** Total speech minutes generated */
  speechMinutes: number;
  /** Total music minutes generated */
  musicMinutes: number;
  /** Total estimated cost in USD */
  totalCost: number;
  /** Individual generation records */
  generations: GenerationRecord[];
}

/**
 * Configurable daily limits (from environment variables)
 */
export interface DailyLimits {
  /** Maximum images per day */
  images?: number;
  /** Maximum videos per day */
  videos?: number;
  /** Maximum speech minutes per day */
  speechMinutes?: number;
  /** Maximum music minutes per day */
  musicMinutes?: number;
  /** Maximum total cost in USD per day */
  totalCost?: number;
  /** Hour (UTC) when limits reset (default: 0) */
  resetHourUTC?: number;
}

/**
 * Resource-specific usage counts for session summary
 */
export interface ResourceUsage {
  generated: number;
  cached: number;
  cost: number;
  /** Total seconds for video, minutes for audio */
  duration?: number;
}

/**
 * Session-level usage summary (for a single render)
 */
export interface SessionSummary {
  images: ResourceUsage;
  videos: ResourceUsage;
  speech: ResourceUsage;
  music: ResourceUsage;
  /** Total estimated cost for this session */
  totalCost: number;
  /** Total generations in this session */
  totalCount: number;
  /** Estimated savings from cache hits */
  savedFromCache: number;
}

/**
 * Result of a limit check
 */
export interface LimitCheckResult {
  /** Whether the generation is allowed */
  allowed: boolean;
  /** Which limit would be exceeded (if any) */
  limitType?: keyof DailyLimits;
  /** Current usage value */
  current?: number;
  /** Configured limit value */
  limit?: number;
  /** Percentage of limit used */
  percent?: number;
  /** Whether this is a warning (80% threshold) */
  isWarning?: boolean;
}

/**
 * Limit status for display (includes current/limit/percent)
 */
export interface LimitStatus {
  current: number;
  limit: number;
  percent: number;
}

/**
 * Options for creating a UsageTracker
 */
export interface UsageTrackerOptions {
  /** Custom limits (overrides env vars) */
  limits?: DailyLimits;
  /** Callback when a generation is recorded */
  onGeneration?: (record: GenerationRecord) => void;
  /** Callback when approaching a limit (80% threshold) */
  onLimitWarning?: (result: LimitCheckResult) => void;
  /** Custom usage directory (default: .cache/usage) */
  usageDir?: string;
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean;
}

/**
 * JSON output schema for --json mode
 */
export interface UsageJsonOutput {
  date: string;
  counts: {
    image: number;
    video: number;
    speech: number;
    music: number;
  };
  durations: {
    video: number;
  };
  cost: {
    total: number;
  };
  limits?: {
    images?: LimitStatus;
    videos?: LimitStatus;
    speechMinutes?: LimitStatus;
    musicMinutes?: LimitStatus;
    cost?: LimitStatus;
  };
  generations: GenerationRecord[];
}

/**
 * Error thrown when daily limit is exceeded
 */
export class UsageLimitError extends Error {
  readonly limitType: string;
  readonly current: number;
  readonly limit: number;

  constructor(limitType: string, current: number, limit: number) {
    super(`Daily limit exceeded for ${limitType}`);
    this.name = "UsageLimitError";
    this.limitType = limitType;
    this.current = current;
    this.limit = limit;
  }

  toJSON() {
    return {
      error: "USAGE_LIMIT_EXCEEDED",
      limitType: this.limitType,
      current: this.current,
      limit: this.limit,
      message: this.message,
      hint: `To increase: export VARG_DAILY_LIMIT_${this.limitType.toUpperCase()}=${this.limit * 2}`,
    };
  }
}
