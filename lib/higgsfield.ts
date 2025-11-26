#!/usr/bin/env bun
/**
 * Higgsfield client wrapper - backward compatible
 * This file re-exports the new HTTP-based implementation from lib/higgsfield/
 * 
 * usage: bun run lib/higgsfield.ts <command> <args>
 */

import {
  SoulClient,
  generateSoul,
  listSoulStyles,
  SoulSize,
  SoulQuality,
  BatchSize,
  type SoulGenerationParams,
} from "./higgsfield/soul";
import HiggsfieldClient, {
  type HiggsfieldConfig,
  type GenerationResponse,
} from "./higgsfield/index";

// Re-export everything from the new modules
export { HiggsfieldClient, SoulClient, generateSoul, listSoulStyles };
export { SoulSize, SoulQuality, BatchSize };
export type { SoulGenerationParams, HiggsfieldConfig, GenerationResponse };

// Backward compatible interfaces
export interface GenerateSoulArgs {
  prompt: string;
  widthAndHeight?: (typeof SoulSize)[keyof typeof SoulSize];
  quality?: (typeof SoulQuality)[keyof typeof SoulQuality];
  styleId?: string;
  batchSize?: (typeof BatchSize)[keyof typeof BatchSize];
  enhancePrompt?: boolean;
}

// Legacy function that matches old API
export async function generateSoulLegacy(
  args: GenerateSoulArgs,
): Promise<GenerationResponse> {
  return await generateSoul({
    prompt: args.prompt,
    width_and_height: args.widthAndHeight || SoulSize.PORTRAIT_1152x2048,
    quality: args.quality || SoulQuality.HD,
    style_id: args.styleId,
    batch_size: args.batchSize || BatchSize.SINGLE,
    enhance_prompt: args.enhancePrompt ?? false,
  });
}

// CLI runner (same as before for backward compatibility)
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "generate_soul": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/higgsfield.ts generate_soul <prompt> [styleId]
        `);
        process.exit(1);
      }

      const result = await generateSoulLegacy({
        prompt: args[0],
        styleId: args[1],
      });

      console.log(`\nRequest ID: ${result.request_id}`);
      console.log(`Status: ${result.status}`);

      if (result.status === "completed" && result.images) {
        console.log("\nGenerated Images:");
        for (const image of result.images) {
          console.log(`  - ${image.url}`);
        }
      }
      break;
    }

    case "list_styles": {
      const styles = await listSoulStyles();
      console.log(JSON.stringify(styles, null, 2));
      break;
    }

    default:
      console.log(`
usage:
  bun run lib/higgsfield.ts generate_soul <prompt> [styleId]
  bun run lib/higgsfield.ts list_styles

note: for more advanced features, use:
  bun run lib/higgsfield/soul.ts <command>
      `);
      process.exit(1);
  }
}
