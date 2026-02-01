/**
 * fal.ai pricing implementation (provider-scoped)
 */

import type {
  PricingRegistry,
  PricingResult,
  ProviderPricing,
} from "../../usage/pricing";
import type { PricingUnavailableError } from "../../usage/pricing-errors";
import type {
  GenerationMetrics,
  PriceInfo,
  ResourceType,
  UsageProvider,
} from "../../usage/types";
import { FalPricingApi, resolveEndpointId } from "./pricing-api";

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
    return this.api.fetchPrice(endpointId);
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
        cost = priceInfo.price * (metrics.durationSeconds ?? 5);
        break;
      case "minute":
        cost = priceInfo.price * ((metrics.durationSeconds ?? 30) / 60);
        break;
      case "1k_chars":
        cost = priceInfo.price * ((metrics.characterCount ?? 100) / 1000);
        break;
      default:
        console.warn(
          `[varg] Unknown pricing unit "${priceInfo.unit}" for model "${metrics.modelId}" - cost set to $0`,
        );
        cost = 0;
    }

    return { priceInfo, cost };
  }
}

export function registerFalPricing(
  registry: PricingRegistry,
  apiKey?: string,
): void {
  const api = apiKey ? new FalPricingApi(apiKey) : undefined;
  registry.register(new FalPricing(api));
}
