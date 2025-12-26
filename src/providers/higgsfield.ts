/**
 * Higgsfield provider for Soul image generation and character creation
 */

import {
  BatchSize,
  HiggsfieldClient,
  InputImageType,
  SoulQuality,
  SoulSize,
} from "@higgsfield/client";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export class HiggsfieldProvider extends BaseProvider {
  readonly name = "higgsfield";
  private _client: HiggsfieldClient | null = null;

  /**
   * Lazy initialization of the client to avoid errors when API keys aren't set
   */
  private get client(): HiggsfieldClient {
    if (!this._client) {
      const apiKey =
        this.config.apiKey ||
        process.env.HIGGSFIELD_API_KEY ||
        process.env.HF_API_KEY;
      const apiSecret =
        process.env.HIGGSFIELD_SECRET || process.env.HF_API_SECRET;

      if (!apiKey || !apiSecret) {
        throw new Error(
          "Higgsfield API credentials not found. Set HIGGSFIELD_API_KEY/HF_API_KEY and HIGGSFIELD_SECRET/HF_API_SECRET environment variables.",
        );
      }

      this._client = new HiggsfieldClient({ apiKey, apiSecret });
    }
    return this._client;
  }

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const jobSet = await this.client.generate(model as "/v1/text2image/soul", {
      prompt: inputs.prompt as string,
      width_and_height:
        (inputs.widthAndHeight as (typeof SoulSize)[keyof typeof SoulSize]) ||
        SoulSize.PORTRAIT_1152x2048,
      quality:
        (inputs.quality as (typeof SoulQuality)[keyof typeof SoulQuality]) ||
        SoulQuality.HD,
      style_id: inputs.styleId as string | undefined,
      batch_size:
        (inputs.batchSize as (typeof BatchSize)[keyof typeof BatchSize]) ||
        BatchSize.SINGLE,
      enhance_prompt: (inputs.enhancePrompt as boolean) ?? false,
    });

    console.log(`[higgsfield] job submitted: ${jobSet.id}`);
    return jobSet.id;
  }

  async getStatus(_jobId: string): Promise<JobStatusUpdate> {
    // Higgsfield jobs complete synchronously via submit
    return { status: "completed" };
  }

  async getResult(_jobId: string): Promise<unknown> {
    return null;
  }

  // ============================================================================
  // High-level convenience methods
  // ============================================================================

  async generateSoul(args: {
    prompt: string;
    widthAndHeight?: (typeof SoulSize)[keyof typeof SoulSize];
    quality?: (typeof SoulQuality)[keyof typeof SoulQuality];
    styleId?: string;
    batchSize?: (typeof BatchSize)[keyof typeof BatchSize];
    enhancePrompt?: boolean;
  }) {
    console.log("[higgsfield] generating soul image");
    console.log(`[higgsfield] prompt: ${args.prompt}`);

    const jobSet = await this.client.generate("/v1/text2image/soul", {
      prompt: args.prompt,
      width_and_height: args.widthAndHeight || SoulSize.PORTRAIT_1152x2048,
      quality: args.quality || SoulQuality.HD,
      style_id: args.styleId,
      batch_size: args.batchSize || BatchSize.SINGLE,
      enhance_prompt: args.enhancePrompt ?? false,
    });

    console.log(`[higgsfield] job created: ${jobSet.id}`);
    return jobSet;
  }

  async listSoulStyles() {
    console.log("[higgsfield] fetching soul styles");
    return this.client.getSoulStyles();
  }

  async createSoulId(args: { name: string; imageUrls: string[] }) {
    console.log(`[higgsfield] creating soul id: ${args.name}`);
    console.log(`[higgsfield] images: ${args.imageUrls.length}`);

    const soulId = await this.client.createSoulId({
      name: args.name,
      input_images: args.imageUrls.map((url) => ({
        type: InputImageType.IMAGE_URL,
        image_url: url,
      })),
    });

    console.log(`[higgsfield] soul id created: ${soulId.id}`);
    return soulId;
  }

  async listSoulIds(page = 1, pageSize = 20) {
    console.log("[higgsfield] listing soul ids");
    return this.client.listSoulIds(page, pageSize);
  }
}

// Re-export useful enums
export { BatchSize, SoulQuality, SoulSize };

// Export singleton instance (lazy initialization means no error on import)
export const higgsfieldProvider = new HiggsfieldProvider();

// Re-export convenience functions for backward compatibility
export const generateSoul = (
  args: Parameters<HiggsfieldProvider["generateSoul"]>[0],
) => higgsfieldProvider.generateSoul(args);
export const listSoulStyles = () => higgsfieldProvider.listSoulStyles();
export const createSoulId = (
  args: Parameters<HiggsfieldProvider["createSoulId"]>[0],
) => higgsfieldProvider.createSoulId(args);
export const listSoulIds = (page?: number, pageSize?: number) =>
  higgsfieldProvider.listSoulIds(page, pageSize);
