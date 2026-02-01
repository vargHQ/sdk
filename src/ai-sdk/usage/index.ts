/**
 * Usage tracking module for the varg SDK
 *
 * Provides cost estimation, daily limits, and usage persistence.
 *
 * @example
 * ```typescript
 * import { createUsageTracker, formatCost } from "vargai/usage";
 *
 * const tracker = await createUsageTracker();
 *
 * // Check limits before generation
 * tracker.assertLimits("image");
 *
 * // Record a generation
 * await tracker.record({
 *   provider: "fal",
 *   modelId: "flux-schnell",
 *   resourceType: "image",
 *   cached: false,
 * });
 *
 * // Get session summary
 * const summary = await tracker.getSessionSummary();
 * console.log(`Total cost: ${formatCost(summary.totalCost)}`);
 *
 * // Save to disk
 * await tracker.save();
 * ```
 */

// Pricing
export {
  defaultPricing,
  ElevenLabsPricing,
  estimateCost,
  formatCost,
  PricingRegistry,
  type PricingResult,
  type ProviderPricing,
} from "./pricing";
// Pricing API
export { PricingUnavailableError } from "./pricing-errors";

// Storage
export {
  createEmptyState,
  getTimeUntilReset,
  getTodayDate,
  getUsageHistory,
  listUsageDates,
  loadDailyUsage,
  saveDailyUsage,
} from "./storage";

// Tracker
export {
  createUsageTracker,
  getUsageDir,
  isTrackingEnabled,
  loadLimitsFromEnv,
  UsageTracker,
} from "./tracker";

// Types
export {
  type DailyLimits,
  type DailyUsageState,
  type GenerationMetrics,
  type GenerationRecord,
  type LimitCheckResult,
  type LimitStatus,
  type PriceInfo,
  type PricingUnit,
  type ResourceType,
  type ResourceUsage,
  type SessionSummary,
  type UsageJsonOutput,
  UsageLimitError,
  type UsageProvider,
  type UsageTrackerOptions,
} from "./types";
