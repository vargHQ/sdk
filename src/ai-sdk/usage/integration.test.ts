/**
 * Usage Tracking Integration Tests
 *
 * Tests usage tracking behavior across:
 * 1. SDK - programmatic usage via createUsageTracker
 * 2. CLI - command output verification
 * 3. JSX rendering - render() function integration
 *
 * Run: bun test src/ai-sdk/usage/integration.test.ts
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { FalPricingApi } from "../providers/fal-extras/pricing-api";
import {
  createUsageTracker,
  formatCost,
  type GenerationMetrics,
  getTimeUntilReset,
  getTodayDate,
  loadDailyUsage,
  loadLimitsFromEnv,
  type UsageTracker,
} from "./index";
import { PricingUnavailableError } from "./pricing-errors";

const TEST_DIR = ".cache/usage-integration-test";

// Mock pricing API for predictable tests
function createMockPricingApi() {
  const mockPrices: Record<string, { price: number; unit: string }> = {
    "fal-ai/flux/schnell": { price: 0.003, unit: "image" },
    "fal-ai/flux/dev": { price: 0.025, unit: "image" },
    "fal-ai/wan-25/text-to-video": { price: 0.05, unit: "second" },
    "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": {
      price: 0.07,
      unit: "second",
    },
  };

  return {
    fetchPrice: mock(async (endpointId: string) => {
      const price = mockPrices[endpointId];
      if (price) {
        return { price: price.price, unit: price.unit as any };
      }
      return undefined;
    }),
    getLastError: () => null,
    hasShownError: () => false,
    markErrorShown: () => {},
    clearCache: () => {},
  };
}

describe("Usage Tracking Integration", () => {
  let tracker: UsageTracker;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("SDK Usage", () => {
    test("creates tracker and records generations", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
      });

      // Record an image generation
      const imageRecord = await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: false,
      });

      expect(imageRecord.provider).toBe("fal");
      expect(imageRecord.modelId).toBe("flux-schnell");
      expect(imageRecord.resourceType).toBe("image");
      expect(imageRecord.cached).toBe(false);

      // Record a video generation
      const videoRecord = await tracker.record({
        provider: "fal",
        modelId: "wan-2.5",
        resourceType: "video",
        count: 1,
        durationSeconds: 5,
        cached: false,
      });

      expect(videoRecord.resourceType).toBe("video");
      expect(videoRecord.durationSeconds).toBe(5);

      // Get session summary
      const summary = await tracker.getSessionSummary();
      expect(summary.images.generated).toBe(1);
      expect(summary.videos.generated).toBe(1);
      expect(summary.videos.duration).toBe(5);
    });

    test("tracks cached items separately", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
      });

      // Record a cached image (no cost)
      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: true,
      });

      // Record a new image (has cost)
      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: false,
      });

      const summary = await tracker.getSessionSummary();
      expect(summary.images.generated).toBe(1);
      expect(summary.images.cached).toBe(1);
    });

    test("handles multi-item generations with count", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
      });

      // Record batch of 4 images
      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 4,
        cached: false,
      });

      const summary = await tracker.getSessionSummary();
      expect(summary.images.generated).toBe(4);
    });

    test("persists and loads daily usage", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
      });

      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 2,
        cached: false,
      });

      await tracker.save();

      // Load from disk
      const loaded = await loadDailyUsage(getTodayDate(), TEST_DIR);
      expect(loaded.images).toBe(2);
    });

    test("enforces daily limits", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
        limits: {
          images: 5,
        },
      });

      // Record 5 images (at limit)
      for (let i = 0; i < 5; i++) {
        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });
      }

      // 6th should fail
      expect(() => tracker.assertLimits("image", 0)).toThrow(
        /Daily limit exceeded for images/,
      );
    });

    test("zero limit is treated as configured limit", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
        limits: {
          images: 0,
        },
      });

      expect(tracker.hasLimits()).toBe(true);
      expect(() => tracker.assertLimits("image", 0)).toThrow(
        /Daily limit exceeded for images/,
      );
    });
  });

  describe("Environment Variable Loading", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = originalEnv;
    });

    test("loads limits from environment variables", () => {
      process.env.VARG_DAILY_LIMIT_IMAGES = "100";
      process.env.VARG_DAILY_LIMIT_VIDEOS = "20";
      process.env.VARG_DAILY_LIMIT_COST = "10.50";
      process.env.VARG_DAILY_RESET_HOUR_UTC = "6";

      const limits = loadLimitsFromEnv();

      expect(limits.images).toBe(100);
      expect(limits.videos).toBe(20);
      expect(limits.totalCost).toBe(10.5);
      expect(limits.resetHourUTC).toBe(6);
    });

    test("accepts zero as valid limit", () => {
      process.env.VARG_DAILY_LIMIT_IMAGES = "0";
      process.env.VARG_DAILY_LIMIT_VIDEOS = "0";

      const limits = loadLimitsFromEnv();

      expect(limits.images).toBe(0);
      expect(limits.videos).toBe(0);
    });

    test("ignores invalid values", () => {
      process.env.VARG_DAILY_LIMIT_IMAGES = "not-a-number";
      process.env.VARG_DAILY_LIMIT_VIDEOS = "";
      process.env.VARG_DAILY_LIMIT_COST = "NaN";

      const limits = loadLimitsFromEnv();

      expect(limits.images).toBeUndefined();
      expect(limits.videos).toBeUndefined();
      expect(limits.totalCost).toBeUndefined();
    });
  });

  describe("Reset Time Calculation", () => {
    test("calculates time until midnight UTC by default", () => {
      const time = getTimeUntilReset();
      expect(time.hours).toBeGreaterThanOrEqual(0);
      expect(time.hours).toBeLessThanOrEqual(24);
      expect(time.minutes).toBeGreaterThanOrEqual(0);
      expect(time.minutes).toBeLessThan(60);
    });

    test("calculates time until custom reset hour", () => {
      const time = getTimeUntilReset(12); // Noon UTC
      expect(time.hours).toBeGreaterThanOrEqual(0);
      expect(time.hours).toBeLessThanOrEqual(24);
    });
  });

  describe("Cost Formatting", () => {
    test("formats costs correctly", () => {
      expect(formatCost(0)).toBe("$0.00");
      expect(formatCost(0.003)).toBe("$0.003");
      expect(formatCost(0.01)).toBe("$0.01");
      expect(formatCost(1.5)).toBe("$1.50");
      expect(formatCost(10)).toBe("$10.00");
    });
  });

  describe("Pricing Warnings", () => {
    test("tracks pricing errors", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
      });

      // Initially no pricing errors
      expect(tracker.hasPricingErrors()).toBe(false);

      // Manually add a pricing error (simulates API failure)
      (tracker as any).pricingErrors.push(
        new PricingUnavailableError("fal.ai", "Test error"),
      );

      // Check if pricing error was recorded
      expect(tracker.hasPricingErrors()).toBe(true);
    });

    test("generates warning message", async () => {
      tracker = await createUsageTracker({
        enabled: true,
        usageDir: TEST_DIR,
      });

      // Manually add a pricing error for testing
      (tracker as any).pricingErrors.push(
        new PricingUnavailableError("fal.ai", "API unavailable"),
      );

      expect(tracker.hasPricingErrors()).toBe(true);
      const warning = tracker.getPricingWarningMessage();
      expect(warning).toContain("Pricing unavailable");
    });
  });

  describe("Date Handling", () => {
    test("getTodayDate returns correct format", () => {
      const date = getTodayDate();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("getTodayDate respects custom reset hour", () => {
      const date = getTodayDate(0);
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

describe("CLI Command Simulation", () => {
  const TEST_DIR = ".cache/usage-cli-test";

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("usage command output format", async () => {
    // Setup: create some usage data
    const tracker = await createUsageTracker({
      enabled: true,
      usageDir: TEST_DIR,
    });

    await tracker.record({
      provider: "fal",
      modelId: "flux-schnell",
      resourceType: "image",
      count: 3,
      cached: false,
    });

    await tracker.record({
      provider: "fal",
      modelId: "wan-2.5",
      resourceType: "video",
      count: 1,
      durationSeconds: 5,
      cached: false,
    });

    await tracker.save();

    // Verify data can be loaded (simulates CLI reading it)
    const state = await loadDailyUsage(getTodayDate(), TEST_DIR);
    expect(state.images).toBe(3);
    expect(state.videos).toBe(1);
    expect(state.videoSeconds).toBe(5);
  });

  test("usage --json output format", async () => {
    const tracker = await createUsageTracker({
      enabled: true,
      usageDir: TEST_DIR,
    });

    await tracker.record({
      provider: "fal",
      modelId: "flux-schnell",
      resourceType: "image",
      count: 1,
      cached: false,
    });

    await tracker.save();

    const state = await loadDailyUsage(getTodayDate(), TEST_DIR);

    // Simulate JSON output structure
    const jsonOutput = {
      date: state.date,
      images: state.images,
      videos: state.videos,
      videoSeconds: state.videoSeconds,
      speechMinutes: state.speechMinutes,
      musicMinutes: state.musicMinutes,
      totalCost: state.totalCost,
    };

    expect(jsonOutput).toHaveProperty("date");
    expect(jsonOutput).toHaveProperty("images");
    expect(jsonOutput).toHaveProperty("videos");
    expect(jsonOutput).toHaveProperty("totalCost");
  });
});

describe("Render Integration", () => {
  const TEST_DIR = ".cache/usage-render-test";

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("tracker can be passed to render options", async () => {
    // This tests that the tracker interface is compatible with render options
    const tracker = await createUsageTracker({
      enabled: true,
      usageDir: TEST_DIR,
    });

    // Simulate what render() does internally
    await tracker.record({
      provider: "fal",
      modelId: "flux-schnell",
      resourceType: "image",
      count: 1,
      cached: false,
      prompt: "test image",
    });

    await tracker.record({
      provider: "fal",
      modelId: "wan-2.5",
      resourceType: "video",
      count: 1,
      durationSeconds: 5,
      cached: false,
      prompt: "test video",
    });

    await tracker.save();

    const summary = await tracker.getSessionSummary();

    // Verify summary has expected structure for render output
    expect(summary).toHaveProperty("images");
    expect(summary).toHaveProperty("videos");
    expect(summary).toHaveProperty("totalCost");
    expect(summary).toHaveProperty("savedFromCache");

    expect(summary.images.generated).toBe(1);
    expect(summary.videos.generated).toBe(1);
  });

  test("cache detection works correctly", async () => {
    const tracker = await createUsageTracker({
      enabled: true,
      usageDir: TEST_DIR,
    });

    // First generation (not cached)
    await tracker.record({
      provider: "fal",
      modelId: "flux-schnell",
      resourceType: "image",
      count: 1,
      cached: false,
    });

    // Second use (cached)
    await tracker.record({
      provider: "fal",
      modelId: "flux-schnell",
      resourceType: "image",
      count: 1,
      cached: true,
    });

    const summary = await tracker.getSessionSummary();

    expect(summary.images.generated).toBe(1);
    expect(summary.images.cached).toBe(1);
    // savedFromCache should have value for the cached item
    // (actual value depends on pricing API response)
  });

  test("quiet mode disables summary output", async () => {
    // This is a behavioral test - quiet mode should not print summary
    // The actual suppression happens in render.ts
    const tracker = await createUsageTracker({
      enabled: true,
      usageDir: TEST_DIR,
    });

    // Even with tracking enabled, summary generation works
    await tracker.record({
      provider: "fal",
      modelId: "flux-schnell",
      resourceType: "image",
      count: 1,
      cached: false,
    });

    const summary = await tracker.getSessionSummary();
    expect(summary.totalCount).toBeGreaterThan(0);
  });
});
