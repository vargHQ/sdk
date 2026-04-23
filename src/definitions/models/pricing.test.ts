import { describe, expect, test } from "bun:test";
import {
  allModels,
  calculateProviderCost,
  getModelPricing,
  getModelPricingBounds,
} from "./index";

describe("SDK pricing formulas", () => {
  test("all models have pricing defined", () => {
    for (const model of allModels) {
      expect(model.pricing).toBeDefined();
      expect(Object.keys(model.pricing!).length).toBeGreaterThan(0);
    }
  });

  test("all pricing formulas return positive numbers", () => {
    for (const model of allModels) {
      for (const [provider, pricing] of Object.entries(model.pricing!)) {
        const cost = pricing.calculate({});
        expect(cost).toBeGreaterThan(0);
        expect(typeof cost).toBe("number");
        expect(Number.isFinite(cost)).toBe(true);
      }
    }
  });

  test("all pricing formulas have valid bounds", () => {
    for (const model of allModels) {
      for (const [provider, pricing] of Object.entries(model.pricing!)) {
        expect(pricing.minUsd).toBeGreaterThan(0);
        expect(pricing.maxUsd).toBeGreaterThanOrEqual(pricing.minUsd);
        expect(pricing.description.length).toBeGreaterThan(0);
      }
    }
  });

  // --- Seedance: dynamic per-second pricing ---

  test("seedance-2-preview: $0.25/s at 5s = $1.25", () => {
    const cost = calculateProviderCost("seedance-2-preview", "piapi", {
      duration: 5,
    });
    expect(cost).toBe(1.25);
  });

  test("seedance-2-preview: $0.25/s at 10s = $2.50", () => {
    const cost = calculateProviderCost("seedance-2-preview", "piapi", {
      duration: 10,
    });
    expect(cost).toBe(2.5);
  });

  test("seedance-2-preview: $0.25/s at 15s = $3.75", () => {
    const cost = calculateProviderCost("seedance-2-preview", "piapi", {
      duration: 15,
    });
    expect(cost).toBe(3.75);
  });

  test("seedance-2-fast-preview: $0.15/s at 5s = $0.75", () => {
    const cost = calculateProviderCost("seedance-2-fast-preview", "piapi", {
      duration: 5,
    });
    expect(cost).toBe(0.75);
  });

  test("seedance-2-fast-preview: $0.15/s at 15s = $2.25", () => {
    const cost = calculateProviderCost("seedance-2-fast-preview", "piapi", {
      duration: 15,
    });
    expect(cost).toBe(2.25);
  });

  test("seedance defaults to 5s when no duration provided", () => {
    const cost = calculateProviderCost("seedance-2-preview", "piapi", {});
    expect(cost).toBe(1.25); // $0.25 * 5
  });

  // --- HeyGen: per-second estimated from script ---

  test("heygen-avatar: defaults to ~30s = $3.00 with no params", () => {
    const cost = calculateProviderCost("heygen-avatar", "heygen", {});
    expect(cost).toBe(3.0); // $0.10 * 30
  });

  test("heygen-avatar: explicit 10s duration = $1.00", () => {
    const cost = calculateProviderCost("heygen-avatar", "heygen", {
      duration: 10,
    });
    expect(cost).toBe(1.0);
  });

  test("heygen-avatar: estimates duration from characters", () => {
    // 125 chars / 12.5 chars/sec = 10s → $1.00
    const cost = calculateProviderCost("heygen-avatar", "heygen", {
      characters: 125,
    });
    expect(cost).toBe(1.0);
  });

  // --- Duration-based video models ---

  test("kling: 5s audio off = $0.56", () => {
    const cost = calculateProviderCost("kling", "fal", { duration: 5 });
    expect(cost).toBe(0.56);
  });

  test("kling: 5s audio on = $0.70", () => {
    const cost = calculateProviderCost("kling", "fal", {
      duration: 5,
      generateAudio: true,
    });
    expect(cost).toBeCloseTo(0.7);
  });

  test("kling: 10s audio off = $1.12", () => {
    const cost = calculateProviderCost("kling", "fal", { duration: 10 });
    expect(cost).toBeCloseTo(1.12);
  });

  test("kling: 10s audio on = $1.40", () => {
    const cost = calculateProviderCost("kling", "fal", {
      duration: 10,
      generateAudio: true,
    });
    expect(cost).toBeCloseTo(1.4);
  });

  // --- Image models: per-image ---

  test("flux: per-image pricing, 1 image default", () => {
    const cost = calculateProviderCost("flux", "fal", {});
    expect(cost).toBeGreaterThan(0);
  });

  test("flux: 4 images costs 4x a single image", () => {
    const cost1 = calculateProviderCost("flux", "fal", { numImages: 1 });
    const cost4 = calculateProviderCost("flux", "fal", { numImages: 4 });
    expect(cost4).toBe(cost1! * 4);
  });

  test("phota/enhance: per-image pricing", () => {
    const cost = calculateProviderCost("phota/enhance", "fal", {});
    expect(cost).toBe(0.13);
  });

  // --- Speech: per-character ---

  test("elevenlabs-tts: per-character pricing scales with length", () => {
    const cost500 = calculateProviderCost("elevenlabs-tts", "elevenlabs", {
      characters: 500,
    });
    const cost1000 = calculateProviderCost("elevenlabs-tts", "elevenlabs", {
      characters: 1000,
    });
    expect(cost1000).toBeGreaterThan(0);
    expect(cost1000).toBe(cost500! * 2);
  });

  // --- Lookup utilities ---

  test("getModelPricing returns null for unknown model", () => {
    const pricing = getModelPricing("nonexistent-model", "fal");
    expect(pricing).toBeNull();
  });

  test("getModelPricing returns null for unknown provider", () => {
    const pricing = getModelPricing("kling", "nonexistent-provider");
    expect(pricing).toBeNull();
  });

  test("calculateProviderCost returns null for unknown model", () => {
    const cost = calculateProviderCost("nonexistent", "fal", {});
    expect(cost).toBeNull();
  });

  test("getModelPricingBounds returns correct bounds for seedance", () => {
    const bounds = getModelPricingBounds("seedance-2-preview", "piapi");
    expect(bounds).not.toBeNull();
    expect(bounds!.minUsd).toBe(1.25);
    expect(bounds!.maxUsd).toBe(3.75);
  });

  test("getModelPricingBounds returns null for unknown model", () => {
    const bounds = getModelPricingBounds("nonexistent", "fal");
    expect(bounds).toBeNull();
  });

  // --- Whisper: multi-provider ---

  test("whisper: groq pricing returns positive value", () => {
    const cost = calculateProviderCost("whisper", "groq", {});
    expect(cost).toBeGreaterThan(0);
  });

  test("whisper: fireworks pricing returns positive value", () => {
    const cost = calculateProviderCost("whisper", "fireworks", {});
    expect(cost).toBeGreaterThan(0);
  });

  test("whisper: groq and fireworks have different prices", () => {
    const groq = calculateProviderCost("whisper", "groq", {});
    const fireworks = calculateProviderCost("whisper", "fireworks", {});
    expect(groq).not.toBe(fireworks);
  });
});
