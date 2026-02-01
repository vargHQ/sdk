/**
 * Error thrown when a pricing provider is unavailable.
 */
export class PricingUnavailableError extends Error {
  readonly provider: string;
  readonly reason: string;

  constructor(provider: string, reason: string) {
    super(
      `Pricing unavailable from ${provider}: ${reason}. ` +
        `Cost tracking is disabled. Proceed based on your own usage intuition.`,
    );
    this.name = "PricingUnavailableError";
    this.provider = provider;
    this.reason = reason;
  }
}
