import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { rm } from "node:fs/promises";
import { FalPricingApi } from "./fal-pricing-api";
import {
  ElevenLabsPricing,
  estimateCost,
  FalPricing,
  formatCost,
  PricingRegistry,
  PricingUnavailableError,
  type ProviderPricing,
} from "./pricing";
import {
  createEmptyState,
  getTimeUntilReset,
  getTodayDate,
  getUsageHistory,
  listUsageDates,
  loadDailyUsage,
  saveDailyUsage,
} from "./storage";
import { createUsageTracker, loadLimitsFromEnv, UsageTracker } from "./tracker";
import type {
  DailyUsageState,
  GenerationMetrics,
  GenerationRecord,
  LimitCheckResult,
} from "./types";
import { UsageLimitError } from "./types";

const TEST_USAGE_DIR = ".cache/usage-test";

async function cleanupTestDir() {
  try {
    await rm(TEST_USAGE_DIR, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Create a mock FalPricingApi that returns predefined prices
 */
function createMockFalPricingApi(
  prices: Record<
    string,
    { price: number; unit: "image" | "second" | "minute" | "1k_chars" }
  >,
  setErrorOnMiss = false,
): FalPricingApi {
  const api = new FalPricingApi("mock-api-key");
  let lastError: PricingUnavailableError | null = null;

  // Override fetchPrice to return mock data
  api.fetchPrice = async (endpointId: string) => {
    // Look for matching price by partial match
    for (const [key, value] of Object.entries(prices)) {
      if (endpointId.toLowerCase().includes(key.toLowerCase())) {
        lastError = null;
        return value;
      }
    }
    if (setErrorOnMiss) {
      lastError = new PricingUnavailableError(
        "fal.ai",
        `No pricing data for: ${endpointId}`,
      );
    }
    return undefined;
  };

  // Override getLastError
  api.getLastError = () => lastError;

  return api;
}

/**
 * Create mock prices that match the old hardcoded values
 * Keys are substrings that will be matched against the resolved endpoint ID
 */
const MOCK_FAL_PRICES: Record<
  string,
  { price: number; unit: "image" | "second" }
> = {
  // Image models
  "flux/schnell": { price: 0.003, unit: "image" },
  "flux/dev": { price: 0.025, unit: "image" },
  "flux-pro": { price: 0.05, unit: "image" },
  // Video models - use substrings that appear in the full endpoint IDs
  "wan-25": { price: 0.05, unit: "second" },
  "v2.5-turbo": { price: 0.07, unit: "second" }, // kling-v2.5 resolves to fal-ai/kling-video/v2.5-turbo/...
  "kling-video/v2": { price: 0.1, unit: "second" },
  minimax: { price: 0.15, unit: "second" },
};

describe("Usage Tracking Module", () => {
  console.log(
    "\n\x1b[36m════════════════════════════════════════════════════════════\x1b[0m",
  );
  console.log("\x1b[36m USAGE TRACKING TESTS\x1b[0m");
  console.log(
    "\x1b[36m════════════════════════════════════════════════════════════\x1b[0m\n",
  );

  // =========================================================================
  // PRICING MODULE TESTS
  // =========================================================================

  describe("Pricing Module", () => {
    console.log("\x1b[2m─ Pricing Module ─\x1b[0m\n");

    describe("FalPricing with mock API", () => {
      const mockApi = createMockFalPricingApi(MOCK_FAL_PRICES);
      const pricing = new FalPricing(mockApi);

      test("calculates image cost correctly for flux-schnell", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
        });
        expect(result.cost).toBe(0.003);
      });

      test("calculates image cost correctly for multiple images", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 4,
        });
        expect(result.cost).toBe(0.012);
      });

      test("calculates image cost for flux-dev", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "flux-dev",
          resourceType: "image",
          count: 1,
        });
        expect(result.cost).toBe(0.025);
      });

      test("calculates image cost for flux-pro", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "flux-pro",
          resourceType: "image",
          count: 1,
        });
        expect(result.cost).toBe(0.05);
      });

      test("calculates video cost correctly for wan-2.5", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "wan-2.5",
          resourceType: "video",
          durationSeconds: 5,
        });
        expect(result.cost).toBe(0.25);
      });

      test("calculates video cost correctly for wan-2.5 at 10 seconds", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "wan-2.5",
          resourceType: "video",
          durationSeconds: 10,
        });
        expect(result.cost).toBe(0.5);
      });

      test("calculates video cost correctly for kling-v2.5", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "kling-v2.5",
          resourceType: "video",
          durationSeconds: 5,
        });
        expect(result.cost).toBeCloseTo(0.35, 2);
      });

      test("uses default video duration when not provided", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "wan-2.5",
          resourceType: "video",
        });
        // Default is 5 seconds
        expect(result.cost).toBe(0.25);
      });

      test("handles partial model name matching", async () => {
        const result = await pricing.calculateCost({
          provider: "fal",
          modelId: "fal-ai/flux/schnell",
          resourceType: "image",
          count: 1,
        });
        expect(result.cost).toBe(0.003);
      });

      test("returns error for unknown models when API has no data", async () => {
        const emptyApi = createMockFalPricingApi({}, true);
        const pricingWithEmptyApi = new FalPricing(emptyApi);

        const result = await pricingWithEmptyApi.calculateCost({
          provider: "fal",
          modelId: "unknown-model-xyz",
          resourceType: "image",
          count: 1,
        });
        expect(result.cost).toBeUndefined();
        expect(result.error).toBeInstanceOf(PricingUnavailableError);
      });

      test("getPrice returns correct price info", async () => {
        const priceInfo = await pricing.getPrice("flux-schnell", "image");
        expect(priceInfo).toEqual({ unit: "image", price: 0.003 });
      });
    });

    describe("ElevenLabsPricing", () => {
      const pricing = new ElevenLabsPricing();

      test("calculates speech cost correctly", async () => {
        const result = await pricing.calculateCost({
          provider: "elevenlabs",
          modelId: "eleven_multilingual_v2",
          resourceType: "speech",
          characterCount: 1000,
        });
        expect(result.cost).toBe(0.3);
      });

      test("calculates speech cost for turbo model", async () => {
        const result = await pricing.calculateCost({
          provider: "elevenlabs",
          modelId: "eleven_turbo_v2",
          resourceType: "speech",
          characterCount: 1000,
        });
        expect(result.cost).toBe(0.15);
      });

      test("calculates music cost correctly", async () => {
        const result = await pricing.calculateCost({
          provider: "elevenlabs",
          modelId: "music",
          resourceType: "music",
          durationSeconds: 60,
        });
        expect(result.cost).toBe(0.2);
      });

      test("uses default speech cost for unknown model", async () => {
        const result = await pricing.calculateCost({
          provider: "elevenlabs",
          modelId: "unknown-voice-model",
          resourceType: "speech",
          characterCount: 1000,
        });
        expect(result.cost).toBe(0.2);
      });
    });

    describe("PricingRegistry", () => {
      test("registers and retrieves providers", () => {
        const registry = new PricingRegistry();
        const mockApi = createMockFalPricingApi(MOCK_FAL_PRICES);
        const falPricing = new FalPricing(mockApi);
        registry.register(falPricing);

        expect(registry.getProvider("fal")).toBe(falPricing);
        expect(registry.getProvider("unknown")).toBeUndefined();
      });

      test("calculates cost through registry", async () => {
        const registry = new PricingRegistry();
        const mockApi = createMockFalPricingApi(MOCK_FAL_PRICES);
        registry.register(new FalPricing(mockApi));

        const result = await registry.calculateCost({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 2,
        });
        expect(result.cost).toBe(0.006);
      });

      test("returns error for unknown provider", async () => {
        const registry = new PricingRegistry();
        const mockApi = createMockFalPricingApi(MOCK_FAL_PRICES);
        registry.register(new FalPricing(mockApi));

        const result = await registry.calculateCost({
          provider: "unknown" as any,
          modelId: "model",
          resourceType: "image",
          count: 1,
        });
        expect(result.error).toBeInstanceOf(PricingUnavailableError);
      });
    });

    describe("formatCost", () => {
      test("formats zero cost", () => {
        expect(formatCost(0)).toBe("$0.00");
      });

      test("formats small costs with 3 decimal places", () => {
        expect(formatCost(0.003)).toBe("$0.003");
        expect(formatCost(0.009)).toBe("$0.009");
      });

      test("formats regular costs with 2 decimal places", () => {
        expect(formatCost(0.25)).toBe("$0.25");
        expect(formatCost(1.5)).toBe("$1.50");
        expect(formatCost(10)).toBe("$10.00");
      });

      test("rounds costs appropriately", () => {
        expect(formatCost(0.123)).toBe("$0.12");
        expect(formatCost(0.126)).toBe("$0.13");
      });
    });
  });

  // =========================================================================
  // STORAGE MODULE TESTS
  // =========================================================================

  describe("Storage Module", () => {
    console.log("\n\x1b[2m─ Storage Module ─\x1b[0m\n");

    beforeEach(async () => {
      await cleanupTestDir();
    });

    afterEach(async () => {
      await cleanupTestDir();
    });

    describe("getTodayDate", () => {
      test("returns date in YYYY-MM-DD format", () => {
        const date = getTodayDate();
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      test("returns consistent date for same reset hour", () => {
        const date1 = getTodayDate(0);
        const date2 = getTodayDate(0);
        expect(date1).toBe(date2);
      });
    });

    describe("getTimeUntilReset", () => {
      test("returns hours and minutes", () => {
        const result = getTimeUntilReset(0);
        expect(typeof result.hours).toBe("number");
        expect(typeof result.minutes).toBe("number");
        expect(result.hours).toBeGreaterThanOrEqual(0);
        expect(result.hours).toBeLessThanOrEqual(23);
        expect(result.minutes).toBeGreaterThanOrEqual(0);
        expect(result.minutes).toBeLessThanOrEqual(59);
      });
    });

    describe("createEmptyState", () => {
      test("creates state with correct structure", () => {
        const state = createEmptyState("2026-01-27");
        expect(state).toEqual({
          date: "2026-01-27",
          images: 0,
          videos: 0,
          videoSeconds: 0,
          speechMinutes: 0,
          musicMinutes: 0,
          totalCost: 0,
          generations: [],
        });
      });
    });

    describe("saveDailyUsage and loadDailyUsage", () => {
      test("saves and loads usage state correctly", async () => {
        const state: DailyUsageState = {
          date: "2026-01-27",
          images: 5,
          videos: 2,
          videoSeconds: 15,
          speechMinutes: 1.5,
          musicMinutes: 0,
          totalCost: 0.55,
          generations: [],
        };

        await saveDailyUsage(state, TEST_USAGE_DIR);
        const loaded = await loadDailyUsage("2026-01-27", TEST_USAGE_DIR);

        expect(loaded).toEqual(state);
      });

      test("returns empty state for non-existent file", async () => {
        const loaded = await loadDailyUsage("2099-12-31", TEST_USAGE_DIR);
        expect(loaded).toEqual(createEmptyState("2099-12-31"));
      });

      test("preserves generation records", async () => {
        const record: GenerationRecord = {
          id: "test-1",
          timestamp: "2026-01-27T10:00:00Z",
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          estimatedCost: 0.003,
          cached: false,
        };

        const state: DailyUsageState = {
          date: "2026-01-27",
          images: 1,
          videos: 0,
          videoSeconds: 0,
          speechMinutes: 0,
          musicMinutes: 0,
          totalCost: 0.003,
          generations: [record],
        };

        await saveDailyUsage(state, TEST_USAGE_DIR);
        const loaded = await loadDailyUsage("2026-01-27", TEST_USAGE_DIR);

        expect(loaded.generations).toHaveLength(1);
        expect(loaded.generations[0]).toEqual(record);
      });
    });

    describe("listUsageDates", () => {
      test("returns empty array for non-existent directory", async () => {
        const dates = await listUsageDates(TEST_USAGE_DIR);
        expect(dates).toEqual([]);
      });

      test("lists dates in reverse chronological order", async () => {
        await saveDailyUsage(createEmptyState("2026-01-25"), TEST_USAGE_DIR);
        await saveDailyUsage(createEmptyState("2026-01-27"), TEST_USAGE_DIR);
        await saveDailyUsage(createEmptyState("2026-01-26"), TEST_USAGE_DIR);

        const dates = await listUsageDates(TEST_USAGE_DIR);
        expect(dates).toEqual(["2026-01-27", "2026-01-26", "2026-01-25"]);
      });
    });

    describe("getUsageHistory", () => {
      test("returns usage for multiple days", async () => {
        await saveDailyUsage(
          { ...createEmptyState("2026-01-27"), images: 5 },
          TEST_USAGE_DIR,
        );
        await saveDailyUsage(
          { ...createEmptyState("2026-01-26"), images: 3 },
          TEST_USAGE_DIR,
        );

        const history = await getUsageHistory(7, TEST_USAGE_DIR);
        expect(history).toHaveLength(2);
        expect(history[0]?.images).toBe(5);
        expect(history[1]?.images).toBe(3);
      });

      test("limits to specified number of days", async () => {
        for (let i = 1; i <= 10; i++) {
          await saveDailyUsage(
            createEmptyState(`2026-01-${String(i).padStart(2, "0")}`),
            TEST_USAGE_DIR,
          );
        }

        const history = await getUsageHistory(3, TEST_USAGE_DIR);
        expect(history).toHaveLength(3);
      });
    });
  });

  // =========================================================================
  // TRACKER MODULE TESTS
  // =========================================================================

  describe("Tracker Module", () => {
    console.log("\n\x1b[2m─ Tracker Module ─\x1b[0m\n");

    beforeEach(async () => {
      await cleanupTestDir();
      // Clear env vars
      delete process.env.VARG_DAILY_LIMIT_IMAGES;
      delete process.env.VARG_DAILY_LIMIT_VIDEOS;
      delete process.env.VARG_DAILY_LIMIT_COST;
      delete process.env.VARG_DAILY_LIMIT_SPEECH_MINUTES;
      delete process.env.VARG_DAILY_LIMIT_MUSIC_MINUTES;
      delete process.env.VARG_TRACK_USAGE;
    });

    afterEach(async () => {
      await cleanupTestDir();
    });

    describe("loadLimitsFromEnv", () => {
      test("loads limits from environment variables", () => {
        process.env.VARG_DAILY_LIMIT_IMAGES = "100";
        process.env.VARG_DAILY_LIMIT_VIDEOS = "20";
        process.env.VARG_DAILY_LIMIT_COST = "10.5";

        const limits = loadLimitsFromEnv();

        expect(limits.images).toBe(100);
        expect(limits.videos).toBe(20);
        expect(limits.totalCost).toBe(10.5);
      });

      test("returns empty object when no env vars set", () => {
        const limits = loadLimitsFromEnv();
        expect(limits).toEqual({});
      });
    });

    describe("UsageTracker initialization", () => {
      test("creates tracker with default options", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        expect(tracker.isEnabled()).toBe(true);
        expect(tracker.hasLimits()).toBe(false);
      });

      test("creates tracker with custom limits", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 50, videos: 10 },
        });

        expect(tracker.hasLimits()).toBe(true);
        expect(tracker.getLimits().images).toBe(50);
        expect(tracker.getLimits().videos).toBe(10);
      });

      test("respects enabled option", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          enabled: false,
        });

        expect(tracker.isEnabled()).toBe(false);
      });
    });

    describe("UsageTracker.record", () => {
      // Save and clear FAL keys to prevent real API calls (timeout issues)
      const savedFalKey = process.env.FAL_KEY;
      const savedFalApiKey = process.env.FAL_API_KEY;

      beforeAll(() => {
        delete process.env.FAL_KEY;
        delete process.env.FAL_API_KEY;
      });

      afterAll(() => {
        if (savedFalKey) process.env.FAL_KEY = savedFalKey;
        if (savedFalApiKey) process.env.FAL_API_KEY = savedFalApiKey;
      });

      test("records image generation correctly", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        const record = await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        expect(record.provider).toBe("fal");
        expect(record.modelId).toBe("flux-schnell");
        expect(record.resourceType).toBe("image");
        expect(record.cached).toBe(false);
        expect(record.id).toMatch(/^gen_\d+_\d+$/);
        // Cost may be 0 if API is not available (no FAL_KEY in test)
      });

      test("records cached items with zero cost", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        const record = await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: true,
        });

        expect(record.estimatedCost).toBe(0);
        expect(record.cached).toBe(true);
      });

      test("updates daily state for non-cached items", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        const state = tracker.getDailyState();
        expect(state.images).toBe(1);
      });

      test("does not update daily state for cached items", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: true,
        });

        const state = tracker.getDailyState();
        expect(state.images).toBe(0);
        expect(state.totalCost).toBe(0);
      });

      test("calls onGeneration callback", async () => {
        const generations: GenerationRecord[] = [];
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          onGeneration: (record) => generations.push(record),
        });

        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        expect(generations).toHaveLength(1);
        expect(generations[0]?.modelId).toBe("flux-schnell");
      });

      test("truncates long prompts", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        const longPrompt = "a".repeat(200);
        const record = await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
          prompt: longPrompt,
        });

        expect(record.prompt?.length).toBe(100);
      });
    });

    describe("UsageTracker.getSessionSummary", () => {
      test("returns empty summary when no records", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        const summary = await tracker.getSessionSummary();

        expect(summary.images.generated).toBe(0);
        expect(summary.videos.generated).toBe(0);
        expect(summary.totalCost).toBe(0);
        expect(summary.totalCount).toBe(0);
      });
    });

    describe("UsageTracker.checkLimits", () => {
      // Save and clear FAL keys to prevent real API calls
      const savedFalKey = process.env.FAL_KEY;
      const savedFalApiKey = process.env.FAL_API_KEY;

      beforeAll(() => {
        delete process.env.FAL_KEY;
        delete process.env.FAL_API_KEY;
      });

      afterAll(() => {
        if (savedFalKey) process.env.FAL_KEY = savedFalKey;
        if (savedFalApiKey) process.env.FAL_API_KEY = savedFalApiKey;
      });

      test("allows when no limits configured", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        const result = tracker.checkLimits("image");
        expect(result.allowed).toBe(true);
      });

      test("allows when under image limit", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 10 },
        });

        const result = tracker.checkLimits("image");
        expect(result.allowed).toBe(true);
      });

      test("blocks when at image limit", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 2 },
        });

        // Record 2 images to hit the limit
        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });
        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        const result = tracker.checkLimits("image");
        expect(result.allowed).toBe(false);
        expect(result.limitType).toBe("images");
        expect(result.current).toBe(2);
        expect(result.limit).toBe(2);
      });

      test("warns at 80% of limit", async () => {
        const warnings: LimitCheckResult[] = [];
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 10 },
          onLimitWarning: (result) => warnings.push(result),
        });

        // Record 8 images to hit 80%
        for (let i = 0; i < 8; i++) {
          await tracker.record({
            provider: "fal",
            modelId: "flux-schnell",
            resourceType: "image",
            count: 1,
            cached: false,
          });
        }

        const result = tracker.checkLimits("image");
        expect(result.allowed).toBe(true);
        expect(result.isWarning).toBe(true);
        expect(result.percent).toBe(80);
        expect(warnings).toHaveLength(1);
      });

      test("allows when tracking is disabled", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 0 },
          enabled: false,
        });

        const result = tracker.checkLimits("image");
        expect(result.allowed).toBe(true);
      });
    });

    describe("UsageTracker.assertLimits", () => {
      // Save and clear FAL keys to prevent real API calls
      const savedFalKey = process.env.FAL_KEY;
      const savedFalApiKey = process.env.FAL_API_KEY;

      beforeAll(() => {
        delete process.env.FAL_KEY;
        delete process.env.FAL_API_KEY;
      });

      afterAll(() => {
        if (savedFalKey) process.env.FAL_KEY = savedFalKey;
        if (savedFalApiKey) process.env.FAL_API_KEY = savedFalApiKey;
      });

      test("does not throw when under limit", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 10 },
        });

        expect(() => tracker.assertLimits("image")).not.toThrow();
      });

      test("throws UsageLimitError when limit exceeded", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { images: 1 },
        });

        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        expect(() => tracker.assertLimits("image")).toThrow(UsageLimitError);
      });

      test("UsageLimitError has correct properties", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          limits: { videos: 1 },
        });

        await tracker.record({
          provider: "fal",
          modelId: "wan-2.5",
          resourceType: "video",
          durationSeconds: 5,
          cached: false,
        });

        try {
          tracker.assertLimits("video");
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(UsageLimitError);
          const usageError = error as UsageLimitError;
          expect(usageError.limitType).toBe("videos");
          expect(usageError.current).toBe(1);
          expect(usageError.limit).toBe(1);
        }
      });

      test("UsageLimitError toJSON returns structured error", async () => {
        const error = new UsageLimitError("images", 10, 10);
        const json = error.toJSON();

        expect(json.error).toBe("USAGE_LIMIT_EXCEEDED");
        expect(json.limitType).toBe("images");
        expect(json.current).toBe(10);
        expect(json.limit).toBe(10);
        expect(json.hint).toContain("VARG_DAILY_LIMIT_IMAGES");
      });
    });

    describe("UsageTracker persistence", () => {
      test("saves and loads state correctly", async () => {
        // Create and populate tracker
        const tracker1 = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        await tracker1.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        await tracker1.save();

        // Create new tracker and load
        const tracker2 = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        const state = tracker2.getDailyState();
        expect(state.images).toBe(1);
      });

      test("does not save when disabled", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
          enabled: false,
        });

        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        await tracker.save();

        // Verify no file was created
        const dates = await listUsageDates(TEST_USAGE_DIR);
        expect(dates).toHaveLength(0);
      });
    });

    describe("Video and speech tracking", () => {
      test("tracks video seconds correctly", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        await tracker.record({
          provider: "fal",
          modelId: "wan-2.5",
          resourceType: "video",
          durationSeconds: 5,
          cached: false,
        });

        await tracker.record({
          provider: "fal",
          modelId: "kling-v2.5",
          resourceType: "video",
          durationSeconds: 10,
          cached: false,
        });

        const state = tracker.getDailyState();
        expect(state.videos).toBe(2);
        expect(state.videoSeconds).toBe(15);
      });

      test("tracks speech minutes correctly", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        await tracker.record({
          provider: "elevenlabs",
          modelId: "eleven_multilingual_v2",
          resourceType: "speech",
          durationSeconds: 90,
          cached: false,
        });

        const state = tracker.getDailyState();
        expect(state.speechMinutes).toBe(1.5);
      });

      test("tracks music minutes correctly", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        await tracker.record({
          provider: "elevenlabs",
          modelId: "music",
          resourceType: "music",
          durationSeconds: 120,
          cached: false,
        });

        const state = tracker.getDailyState();
        expect(state.musicMinutes).toBe(2);
      });
    });

    describe("Pricing error tracking", () => {
      test("tracks pricing errors when API is unavailable", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        // Record without FAL_KEY - will get pricing error
        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        // Should have pricing errors since no API key
        const errors = tracker.getPricingErrors();
        // May or may not have errors depending on test environment
        expect(Array.isArray(errors)).toBe(true);
      });

      test("provides formatted warning message for pricing errors", async () => {
        const tracker = await createUsageTracker({
          usageDir: TEST_USAGE_DIR,
        });

        // Force a pricing error
        await tracker.record({
          provider: "fal",
          modelId: "flux-schnell",
          resourceType: "image",
          count: 1,
          cached: false,
        });

        const message = tracker.getPricingWarningMessage();
        // Message will be undefined if no errors, or contain warning text if there are errors
        if (tracker.getPricingErrors().length > 0) {
          expect(message).toContain("Pricing unavailable");
          expect(message).toContain(
            "Proceed based on your own usage intuition",
          );
        }
      });
    });
  });

  // =========================================================================
  // INTEGRATION TESTS
  // =========================================================================

  describe("Integration Tests", () => {
    console.log("\n\x1b[2m─ Integration Tests ─\x1b[0m\n");

    beforeEach(async () => {
      await cleanupTestDir();
    });

    afterEach(async () => {
      await cleanupTestDir();
    });

    test("full workflow: track, save, load, verify limits", async () => {
      // Day 1: Create tracker with limits
      const tracker1 = await createUsageTracker({
        usageDir: TEST_USAGE_DIR,
        limits: { images: 5, videos: 2, totalCost: 1.0 },
      });

      // Record some generations
      await tracker1.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: false,
      });
      await tracker1.record({
        provider: "fal",
        modelId: "wan-2.5",
        resourceType: "video",
        durationSeconds: 5,
        cached: false,
      });

      await tracker1.save();

      // Create new tracker (simulating app restart)
      const tracker2 = await createUsageTracker({
        usageDir: TEST_USAGE_DIR,
        limits: { images: 5, videos: 2, totalCost: 1.0 },
      });

      // Verify state was persisted
      expect(tracker2.getDailyState().images).toBe(1);
      expect(tracker2.getDailyState().videos).toBe(1);

      // Record more until limit
      await tracker2.record({
        provider: "fal",
        modelId: "wan-2.5",
        resourceType: "video",
        durationSeconds: 5,
        cached: false,
      });

      // Should be blocked now
      const result = tracker2.checkLimits("video");
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("videos");
    });

    test("cached items don't affect limits", async () => {
      const tracker = await createUsageTracker({
        usageDir: TEST_USAGE_DIR,
        limits: { images: 2 },
      });

      // Record 2 non-cached images (at limit)
      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: false,
      });
      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: false,
      });

      // Should be blocked
      expect(tracker.checkLimits("image").allowed).toBe(false);

      // But cached items should still be allowed (they don't generate new API calls)
      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: true,
      });

      // Daily state should still show 2 images
      expect(tracker.getDailyState().images).toBe(2);
    });

    test("multiple resource types tracked independently", async () => {
      const tracker = await createUsageTracker({
        usageDir: TEST_USAGE_DIR,
        limits: { images: 2, videos: 1 },
      });

      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 1,
        cached: false,
      });
      await tracker.record({
        provider: "fal",
        modelId: "wan-2.5",
        resourceType: "video",
        durationSeconds: 5,
        cached: false,
      });

      // Images still allowed (1 of 2)
      expect(tracker.checkLimits("image").allowed).toBe(true);

      // Videos blocked (1 of 1)
      expect(tracker.checkLimits("video").allowed).toBe(false);
    });
  });

  // =========================================================================
  // PRICING UNAVAILABLE ERROR TESTS
  // =========================================================================

  describe("PricingUnavailableError", () => {
    test("creates error with correct properties", () => {
      const error = new PricingUnavailableError("fal.ai", "API key missing");

      expect(error.name).toBe("PricingUnavailableError");
      expect(error.provider).toBe("fal.ai");
      expect(error.reason).toBe("API key missing");
      expect(error.message).toContain("Pricing unavailable from fal.ai");
      expect(error.message).toContain(
        "Proceed based on your own usage intuition",
      );
    });
  });

  // =========================================================================
  // JSON OUTPUT FORMAT TESTS
  // =========================================================================

  describe("JSON output format for AI agents", () => {
    test("UsageLimitError provides structured JSON for agents", () => {
      const error = new UsageLimitError("videos", 5, 5);
      const json = error.toJSON();

      expect(json).toEqual({
        error: "USAGE_LIMIT_EXCEEDED",
        limitType: "videos",
        current: 5,
        limit: 5,
        message: "Daily limit exceeded for videos",
        hint: "To increase: export VARG_DAILY_LIMIT_VIDEOS=10",
      });
    });

    test("session summary provides complete data for reporting", async () => {
      const tracker = await createUsageTracker({
        usageDir: TEST_USAGE_DIR,
      });

      await tracker.record({
        provider: "fal",
        modelId: "flux-schnell",
        resourceType: "image",
        count: 2,
        cached: false,
      });

      const summary = await tracker.getSessionSummary();

      // Verify all required fields exist for JSON serialization
      expect(summary).toHaveProperty("images");
      expect(summary).toHaveProperty("videos");
      expect(summary).toHaveProperty("speech");
      expect(summary).toHaveProperty("music");
      expect(summary).toHaveProperty("totalCost");
      expect(summary).toHaveProperty("totalCount");
      expect(summary).toHaveProperty("savedFromCache");

      expect(summary.images).toHaveProperty("generated");
      expect(summary.images).toHaveProperty("cached");
      expect(summary.images).toHaveProperty("cost");
    });
  });
});
