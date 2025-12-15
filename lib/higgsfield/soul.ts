#!/usr/bin/env bun
/**
 * Higgsfield Soul API - Image generation with Soul styles
 */

import HiggsfieldClient, {
  type GenerationResponse,
  type HiggsfieldConfig,
} from "./index";

const BASE_URL = "https://platform.higgsfield.ai";

// Soul size options
export const SoulSize = {
  PORTRAIT_1152x2048: "1152x2048",
  PORTRAIT_2048x1152: "2048x1152",
  SQUARE_2048x2048: "2048x2048",
  LANDSCAPE_1536x2048: "1536x2048",
  LANDSCAPE_2016x1344: "2016x1344",
} as const;

// Quality options
export const SoulQuality = {
  SD: "720p",
  HD: "1080p",
} as const;

// Batch size options
export const BatchSize = {
  SINGLE: 1,
  FOUR: 4,
} as const;

export interface SoulGenerationParams {
  prompt: string;
  width_and_height?: (typeof SoulSize)[keyof typeof SoulSize];
  quality?: (typeof SoulQuality)[keyof typeof SoulQuality];
  style_id?: string;
  batch_size?: (typeof BatchSize)[keyof typeof BatchSize];
  enhance_prompt?: boolean;
  seed?: number;
  style_strength?: number;
  image_reference?: string;
  custom_reference_id?: string;
  custom_reference_strength?: number;
}

export interface SoulStyle {
  id: string;
  name: string;
  preview_url: string;
  description?: string;
}

export class SoulClient extends HiggsfieldClient {
  private static readonly MODEL_ID = "soul";

  /**
   * Generate Soul images
   */
  async generateSoul(
    params: SoulGenerationParams,
    options: {
      webhook?: string;
      pollingInterval?: number;
      maxWaitTime?: number;
      onUpdate?: (status: GenerationResponse) => void;
    } = {},
  ): Promise<GenerationResponse> {
    console.log(`[higgsfield:soul] generating image`);
    console.log(`[higgsfield:soul] prompt: ${params.prompt}`);

    return await this.generate(SoulClient.MODEL_ID, params, {
      ...options,
      onUpdate: (status) => {
        console.log(`[higgsfield:soul] status: ${status.status}`);
        if (options.onUpdate) {
          options.onUpdate(status);
        }
      },
    });
  }

  /**
   * Get available Soul styles
   */
  async getSoulStyles(): Promise<SoulStyle[]> {
    console.log("[higgsfield:soul] fetching soul styles");

    const url = `${BASE_URL}/v1/text2image/soul-styles`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${process.env.HIGGSFIELD_API_KEY || process.env.HF_API_KEY}:${process.env.HIGGSFIELD_SECRET || process.env.HF_API_SECRET}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Higgsfield API error (${response.status}): ${errorText}`,
      );
    }

    const styles = (await response.json()) as SoulStyle[];
    console.log(`[higgsfield:soul] found ${styles.length} styles`);
    return styles;
  }
}

// Convenience function for generating Soul images
export async function generateSoul(
  params: SoulGenerationParams,
  config?: HiggsfieldConfig,
): Promise<GenerationResponse> {
  const client = new SoulClient(config);
  return await client.generateSoul(params);
}

// Convenience function for listing styles
export async function listSoulStyles(
  config?: HiggsfieldConfig,
): Promise<SoulStyle[]> {
  const client = new SoulClient(config);
  return await client.getSoulStyles();
}

// CLI runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "generate": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/higgsfield/soul.ts generate <prompt> [styleId] [webhook]

examples:
  bun run lib/higgsfield/soul.ts generate "beautiful sunset"
  bun run lib/higgsfield/soul.ts generate "portrait of a woman" "style-id-123"
  bun run lib/higgsfield/soul.ts generate "landscape" "" "https://webhook.url"
        `);
        process.exit(1);
      }

      const result = await generateSoul({
        prompt: args[0],
        style_id: args[1] || undefined,
        width_and_height: SoulSize.PORTRAIT_1152x2048,
        quality: SoulQuality.HD,
        batch_size: BatchSize.SINGLE,
        enhance_prompt: false,
      });

      console.log("\n=== Generation Result ===");
      console.log(`Request ID: ${result.request_id}`);
      console.log(`Status: ${result.status}`);

      if (result.status === "completed" && result.images) {
        console.log("\nGenerated Images:");
        for (const image of result.images) {
          console.log(`  - ${image.url}`);
        }
      } else if (result.status === "failed") {
        console.log(`\nError: ${result.error}`);
      } else if (result.status === "nsfw") {
        console.log("\nContent failed moderation (NSFW)");
      }

      break;
    }

    case "list_styles": {
      const styles = await listSoulStyles();

      console.log("\n=== Soul Styles ===");
      for (const style of styles) {
        console.log(`\nID: ${style.id}`);
        console.log(`Name: ${style.name}`);
        console.log(`Preview: ${style.preview_url}`);
        if (style.description) {
          console.log(`Description: ${style.description}`);
        }
      }

      break;
    }

    case "status": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/higgsfield/soul.ts status <request_id>
        `);
        process.exit(1);
      }

      const client = new SoulClient();
      const status = await client.getStatus(args[0]);

      console.log("\n=== Request Status ===");
      console.log(JSON.stringify(status, null, 2));

      break;
    }

    case "cancel": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/higgsfield/soul.ts cancel <request_id>
        `);
        process.exit(1);
      }

      const client = new SoulClient();
      const canceled = await client.cancelRequest(args[0]);

      if (canceled) {
        console.log("\n✓ Request canceled successfully");
      } else {
        console.log("\n✗ Request could not be canceled (already processing)");
      }

      break;
    }

    default:
      console.log(`
usage:
  bun run lib/higgsfield/soul.ts generate <prompt> [styleId] [webhook]
  bun run lib/higgsfield/soul.ts list_styles
  bun run lib/higgsfield/soul.ts status <request_id>
  bun run lib/higgsfield/soul.ts cancel <request_id>

examples:
  # Generate image
  bun run lib/higgsfield/soul.ts generate "beautiful landscape"
  
  # Generate with style
  bun run lib/higgsfield/soul.ts generate "portrait" "style-id-123"
  
  # List available styles
  bun run lib/higgsfield/soul.ts list_styles
  
  # Check request status
  bun run lib/higgsfield/soul.ts status "request-id-here"
  
  # Cancel pending request
  bun run lib/higgsfield/soul.ts cancel "request-id-here"
      `);
      process.exit(1);
  }
}
