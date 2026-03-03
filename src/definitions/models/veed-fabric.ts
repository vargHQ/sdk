/**
 * VEED Fabric 1.0
 * Image + audio -> talking video
 */

import { z } from "zod";
import { urlSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

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
};

export default definition;
