/**
 * VEED Fabric 1.0
 * Image + audio -> talking video
 */

import { z } from "zod";
import { urlSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

const fabricResolutionSchema = z
  .enum(["480p", "720p"])
  .describe("Output resolution");

// Input schema with Zod
const veedFabricInputSchema = z.object({
  image_url: urlSchema.describe("Input image URL"),
  audio_url: urlSchema.describe("Input audio URL"),
  resolution: fabricResolutionSchema.describe("Output resolution"),
});

// Output schema with Zod
const veedFabricOutputSchema = z.object({
  video: z.object({
    content_type: z.string().optional(),
    url: z.string().url(),
  }),
});

const schema: ZodSchema<
  typeof veedFabricInputSchema,
  typeof veedFabricOutputSchema
> = {
  input: veedFabricInputSchema,
  output: veedFabricOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "veed-fabric",
  description: "VEED Fabric 1.0 - turn an image into a talking video",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "veed/fabric-1.0",
  },
  schema,
  pricing: {
    fal: {
      description: "$0.08/sec (480p), $0.15/sec (720p) via fal",
      calculate: ({ duration = 5, resolution }) => {
        const rate = resolution === "720p" ? 0.15 : 0.08;
        return rate * duration;
      },
      minUsd: 0.24, // ~3s * $0.08 (480p)
      maxUsd: 4.5, // ~30s * $0.15 (720p)
    },
  },
};

export default definition;
