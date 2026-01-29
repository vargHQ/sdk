/**
 * Pricing module for usage tracking
 * Fetches real-time pricing from provider APIs
 *
 * Prices are fetched dynamically from:
 * - fal.ai: https://api.fal.ai/v1/models/pricing
 * - ElevenLabs: Uses static pricing (no public API)
 */

import {
  FalPricingApi,
  PricingUnavailableError,
  resolveEndpointId,
} from "./fal-pricing-api";
import type {
  GenerationMetrics,
  PriceInfo,
  PricingUnit,
  ResourceType,
  UsageProvider,
} from "./types";

export { PricingUnavailableError };

/**
 * Result of a pricing lookup
 */
export interface PricingResult {
  /** Price info if available */
  priceInfo?: PriceInfo;
  /** Calculated cost if price was available */
  cost?: number;
  /** Error if pricing was unavailable */
  error?: PricingUnavailableError;
}

/**
 * Provider pricing interface
 */
export interface ProviderPricing {
  readonly provider: UsageProvider;
  getPrice(
    modelId: string,
    resourceType: ResourceType,
  ): Promise<PriceInfo | undefined>;
  calculateCost(metrics: GenerationMetrics): Promise<PricingResult>;
  /** Get last error (if pricing fetch failed) */
  getLastError(): PricingUnavailableError | null;
  /** Check if error was already shown to user */
  hasShownError(): boolean;
  /** Mark error as shown */
  markErrorShown(): void;
}

/**
 * Registry for provider pricing implementations
 */
export class PricingRegistry {
  private providers = new Map<string, ProviderPricing>();

  register(pricing: ProviderPricing): void {
    this.providers.set(pricing.provider, pricing);
  }

  getProvider(provider: string): ProviderPricing | undefined {
    return this.providers.get(provider);
  }

  async calculateCost(metrics: GenerationMetrics): Promise<PricingResult> {
    const provider = this.providers.get(metrics.provider);
    if (!provider) {
      return {
        error: new PricingUnavailableError(
          metrics.provider,
          "Unknown provider",
        ),
      };
    }
    return provider.calculateCost(metrics);
  }

  async getPrice(
    provider: string,
    modelId: string,
    resourceType: ResourceType,
  ): Promise<PriceInfo | undefined> {
    const p = this.providers.get(provider);
    return p?.getPrice(modelId, resourceType);
  }

  /**
   * Get any unshown pricing errors from providers
   */
  getUnshownErrors(): PricingUnavailableError[] {
    const errors: PricingUnavailableError[] = [];
    for (const provider of this.providers.values()) {
      const error = provider.getLastError();
      if (error && !provider.hasShownError()) {
        errors.push(error);
      }
    }
    return errors;
  }

  /**
   * Mark all errors as shown
   */
  markAllErrorsShown(): void {
    for (const provider of this.providers.values()) {
      provider.markErrorShown();
    }
  }
}

/**
 * fal.ai pricing implementation using dynamic API
 */
export class FalPricing implements ProviderPricing {
  readonly provider: UsageProvider = "fal";
  private api: FalPricingApi;

  constructor(api?: FalPricingApi) {
    this.api = api ?? new FalPricingApi();
  }

  getLastError(): PricingUnavailableError | null {
    return this.api.getLastError();
  }

  hasShownError(): boolean {
    return this.api.hasShownError();
  }

  markErrorShown(): void {
    this.api.markErrorShown();
  }

  async getPrice(
    modelId: string,
    _resourceType: ResourceType,
  ): Promise<PriceInfo | undefined> {
    const endpointId = resolveEndpointId(modelId);
    const result = await this.api.fetchPrice(endpointId);
    return result;
  }

  async calculateCost(metrics: GenerationMetrics): Promise<PricingResult> {
    const endpointId = resolveEndpointId(metrics.modelId);
    const priceInfo = await this.api.fetchPrice(endpointId);

    if (!priceInfo) {
      return {
        error: this.api.getLastError() ?? undefined,
      };
    }

    let cost: number;
    switch (priceInfo.unit) {
      case "image":
        cost = priceInfo.price * (metrics.count ?? 1);
        break;
      case "second":
        // Default to 5 seconds if duration not provided
        cost = priceInfo.price * (metrics.durationSeconds ?? 5);
        break;
      case "minute":
        cost = priceInfo.price * ((metrics.durationSeconds ?? 30) / 60);
        break;
      case "1k_chars":
        cost = priceInfo.price * ((metrics.characterCount ?? 100) / 1000);
        break;
      default:
        cost = 0;
    }

    return { priceInfo, cost };
  }
}

/**
 * ElevenLabs pricing implementation
 * Uses static pricing as ElevenLabs doesn't have a public pricing API
 */
export class ElevenLabsPricing implements ProviderPricing {
  readonly provider: UsageProvider = "elevenlabs";
  private lastError: PricingUnavailableError | null = null;
  private errorShown = false;

  // ElevenLabs pricing is documented but not available via API
  // These are based on their published pricing tiers
  private static readonly PRICES: Record<
    string,
    { unit: PricingUnit; price: number }
  > = {
    eleven_multilingual_v2: { unit: "1k_chars", price: 0.3 },
    eleven_turbo_v2: { unit: "1k_chars", price: 0.15 },
    eleven_monolingual_v1: { unit: "1k_chars", price: 0.3 },
    music: { unit: "minute", price: 0.2 },
  };

  getLastError(): PricingUnavailableError | null {
    return this.lastError;
  }

  hasShownError(): boolean {
    return this.errorShown;
  }

  markErrorShown(): void {
    this.errorShown = true;
  }

  async getPrice(
    modelId: string,
    resourceType: ResourceType,
  ): Promise<PriceInfo | undefined> {
    const modelLower = modelId.toLowerCase();

    for (const [key, entry] of Object.entries(ElevenLabsPricing.PRICES)) {
      if (modelLower.includes(key.toLowerCase())) {
        return entry;
      }
    }

    // Defaults based on resource type
    if (resourceType === "speech") {
      return { unit: "1k_chars", price: 0.2 };
    }
    if (resourceType === "music") {
      return { unit: "minute", price: 0.2 };
    }

    this.lastError = new PricingUnavailableError(
      "elevenlabs",
      `Unknown model: ${modelId}`,
    );
    return undefined;
  }

  async calculateCost(metrics: GenerationMetrics): Promise<PricingResult> {
    const priceInfo = await this.getPrice(
      metrics.modelId,
      metrics.resourceType,
    );
    if (!priceInfo) {
      return {
        error: this.lastError ?? undefined,
      };
    }

    let cost: number;
    switch (priceInfo.unit) {
      case "1k_chars":
        cost = priceInfo.price * ((metrics.characterCount ?? 100) / 1000);
        break;
      case "minute":
        cost = priceInfo.price * ((metrics.durationSeconds ?? 30) / 60);
        break;
      default:
        cost = 0;
    }

    return { priceInfo, cost };
  }
}

/**
 * Default pricing registry with all supported providers
 */
export const defaultPricing = new PricingRegistry();
defaultPricing.register(new FalPricing());
defaultPricing.register(new ElevenLabsPricing());

/**
 * Format cost for display
 * @param cost - Cost in USD
 * @returns Formatted string (e.g., "$0.25" or "$0.003")
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) {
    // Show more precision for small amounts
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Estimate cost before generation (using API lookup)
 * Returns a PricingResult - check result.error for pricing lookup failures
 */
export async function estimateCost(
  provider: UsageProvider,
  modelId: string,
  resourceType: ResourceType,
  defaultDuration = 5,
): Promise<PricingResult> {
  const metrics: GenerationMetrics = {
    provider,
    modelId,
    resourceType,
    count: 1,
    durationSeconds: defaultDuration,
    characterCount: 100,
  };

  return defaultPricing.calculateCost(metrics);
}
