/**
 * fal.ai Pricing API client
 * Fetches real-time pricing from fal.ai's API
 *
 * API Documentation:
 * - GET /v1/models/pricing - Get unit prices for endpoints
 * - POST /v1/models/pricing/estimate - Estimate costs for batch operations
 */

import { PricingUnavailableError } from "../../usage/pricing-errors";
import type { PricingUnit } from "../../usage/types";

const FAL_API_BASE = "https://api.fal.ai";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Price entry from fal.ai API
 */
export interface FalApiPrice {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
}

/**
 * Response from /v1/models/pricing endpoint
 */
export interface FalPricingResponse {
  prices: FalApiPrice[];
}

/**
 * Cached price entry with timestamp
 */
interface CachedPrice {
  price: number;
  unit: PricingUnit;
  fetchedAt: number;
}

/**
 * Map fal.ai unit strings to our PricingUnit type
 */
function mapUnit(falUnit: string): PricingUnit {
  switch (falUnit.toLowerCase()) {
    case "image":
    case "images":
      return "image";
    case "second":
    case "seconds":
    case "sec":
      return "second";
    case "minute":
    case "minutes":
    case "min":
      return "minute";
    case "1k_chars":
    case "characters":
      return "1k_chars";
    default:
      // Default to per-image for unknown units
      return "image";
  }
}

/**
 * fal.ai Pricing API client with caching
 */
export class FalPricingApi {
  private cache = new Map<string, CachedPrice>();
  private apiKey: string | undefined;
  private lastError: PricingUnavailableError | null = null;
  private errorShown = false;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  }

  /**
   * Get the last pricing error (if any)
   */
  getLastError(): PricingUnavailableError | null {
    return this.lastError;
  }

  /**
   * Check if an error has been shown to the user
   */
  hasShownError(): boolean {
    return this.errorShown;
  }

  /**
   * Mark that the error has been shown to user
   */
  markErrorShown(): void {
    this.errorShown = true;
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.lastError = null;
    this.errorShown = false;
  }

  /**
   * Fetch price for a specific endpoint from fal.ai API
   * Returns undefined if pricing is unavailable (with error stored)
   */
  async fetchPrice(
    endpointId: string,
  ): Promise<{ price: number; unit: PricingUnit } | undefined> {
    // Check cache first
    const cached = this.cache.get(endpointId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { price: cached.price, unit: cached.unit };
    }

    if (!this.apiKey) {
      this.lastError = new PricingUnavailableError(
        "fal.ai",
        "No API key configured (FAL_KEY or FAL_API_KEY)",
      );
      return undefined;
    }

    try {
      const url = new URL("/v1/models/pricing", FAL_API_BASE);
      url.searchParams.set("endpoint_id", endpointId);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        this.lastError = new PricingUnavailableError(
          "fal.ai",
          `API returned ${response.status}: ${errorText}`,
        );
        return undefined;
      }

      const data = (await response.json()) as FalPricingResponse;

      if (!data.prices || data.prices.length === 0) {
        this.lastError = new PricingUnavailableError(
          "fal.ai",
          `No pricing data for endpoint: ${endpointId}`,
        );
        return undefined;
      }

      const priceInfo = data.prices[0]!;
      const unit = mapUnit(priceInfo.unit);
      const result = { price: priceInfo.unit_price, unit };

      // Cache the result
      this.cache.set(endpointId, {
        ...result,
        fetchedAt: Date.now(),
      });

      // Clear any previous error on success
      this.lastError = null;

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      this.lastError = new PricingUnavailableError("fal.ai", message);
      return undefined;
    }
  }

  /**
   * Batch fetch prices for multiple endpoints
   * Returns a map of endpoint -> price info
   */
  async fetchPrices(
    endpointIds: string[],
  ): Promise<Map<string, { price: number; unit: PricingUnit }>> {
    const results = new Map<string, { price: number; unit: PricingUnit }>();

    // Fetch in parallel
    const promises = endpointIds.map(async (endpointId) => {
      const price = await this.fetchPrice(endpointId);
      if (price) {
        results.set(endpointId, price);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Estimate cost for a generation using the API
   * Returns undefined if pricing is unavailable
   */
  async estimateCost(
    endpointId: string,
    quantity: number,
  ): Promise<number | undefined> {
    const priceInfo = await this.fetchPrice(endpointId);
    if (!priceInfo) {
      return undefined;
    }

    // Calculate cost based on unit type
    switch (priceInfo.unit) {
      case "image":
        return priceInfo.price * quantity;
      case "second":
        return priceInfo.price * quantity;
      case "minute":
        return priceInfo.price * (quantity / 60);
      case "1k_chars":
        return priceInfo.price * (quantity / 1000);
      default:
        return priceInfo.price * quantity;
    }
  }
}

/**
 * Model ID to fal.ai endpoint ID mapping
 * Used to resolve friendly model names to API endpoint IDs
 */
export const MODEL_TO_ENDPOINT: Record<string, string> = {
  // Image models
  "flux-schnell": "fal-ai/flux/schnell",
  "flux-dev": "fal-ai/flux/dev",
  "flux-pro": "fal-ai/flux-pro/v1.1",
  "recraft-v3": "fal-ai/recraft/v3/text-to-image",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
  ideogram: "fal-ai/ideogram/v3",
  seedream: "fal-ai/bytedance/seedream/v4.5",
  kontext: "fal-ai/flux/kontext/pro",

  // Video models
  "wan-2.5": "fal-ai/wan-25/text-to-video",
  "wan-2.1": "fal-ai/wan-21/text-to-video",
  "kling-v2.6": "fal-ai/kling-video/v2.6/pro/text-to-video",
  "kling-v2.5": "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  "kling-v2.1": "fal-ai/kling-video/v2.1/pro/text-to-video",
  "kling-v2": "fal-ai/kling-video/v2/master/text-to-video",
  kling: "fal-ai/kling-video/v2/master/text-to-video",
  minimax: "fal-ai/minimax-video/text-to-video",
  veo: "fal-ai/veo-3",
  luma: "fal-ai/luma-dream-machine",
  runway: "fal-ai/runway-gen3/turbo/image-to-video",
};

/**
 * Resolve a model ID to a fal.ai endpoint ID
 */
export function resolveEndpointId(modelId: string): string {
  // If already a full endpoint ID (contains /), return as-is
  if (modelId.includes("/")) {
    return modelId;
  }

  // Check mapping
  const mapped = MODEL_TO_ENDPOINT[modelId.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  // Try with fal-ai prefix
  return `fal-ai/${modelId}`;
}
