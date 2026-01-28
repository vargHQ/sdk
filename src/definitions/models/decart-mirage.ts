/**
 * Decart Mirage model definition
 * Real-time WebRTC video generation/transformation via the Decart AI platform
 *
 * Realtime models (browser-side WebRTC):
 *   mirage (25fps), mirage_v2 (22fps), lucy_v2v_720p_rt (25fps),
 *   lucy_v2v_14b_rt (15fps), live_avatar (25fps)
 *
 * These models operate over WebRTC and produce sub-100ms latency streams.
 * Use the DecartProvider's getRealtimeClient() to access the WebRTC API.
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Input schema
const decartMirageInputSchema = z.object({
  prompt: z.string().describe("Text prompt for real-time transformation"),
  model: z
    .enum([
      "mirage",
      "mirage_v2",
      "lucy_v2v_720p_rt",
      "lucy_v2v_14b_rt",
      "live_avatar",
    ])
    .default("mirage_v2")
    .describe("Realtime model to use"),
  fps: z
    .number()
    .optional()
    .describe(
      "Target frames per second (varies by model: mirage=25, mirage_v2=22, lucy_v2v_14b_rt=15)",
    ),
});

// Output schema — realtime models produce a MediaStream, not a file
const decartMirageOutputSchema = z.object({
  connected: z
    .boolean()
    .describe("Whether the WebRTC connection was established"),
  model: z.string().describe("The realtime model in use"),
});

// Schema object
const schema: ZodSchema<
  typeof decartMirageInputSchema,
  typeof decartMirageOutputSchema
> = {
  input: decartMirageInputSchema,
  output: decartMirageOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "decart-mirage",
  description:
    "Decart Mirage real-time model for sub-100ms latency video transformation via WebRTC",
  providers: ["decart"],
  defaultProvider: "decart",
  providerModels: {
    decart: "mirage_v2",
  },
  schema,
};

export default definition;
