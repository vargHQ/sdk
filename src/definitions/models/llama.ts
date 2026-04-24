/**
 * Llama LLM model
 * Fast inference via Groq
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Llama model variants schema
const llamaModelSchema = z.enum([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
]);

// Chat message schema
const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

// Input schema with Zod
const llamaInputSchema = z.object({
  messages: z.array(chatMessageSchema).describe("Chat messages array"),
  model: llamaModelSchema
    .default("llama-3.3-70b-versatile")
    .describe("Llama model variant"),
  temperature: z.number().default(1).describe("Sampling temperature"),
  max_tokens: z.number().int().default(1024).describe("Maximum output tokens"),
  stream: z.boolean().default(false).describe("Stream response"),
});

// Output schema with Zod
const llamaOutputSchema = z.string().describe("Generated text response");

// Schema object for the definition
const schema: ZodSchema<typeof llamaInputSchema, typeof llamaOutputSchema> = {
  input: llamaInputSchema,
  output: llamaOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "llama",
  description: "Meta Llama model for fast text generation via Groq",
  providers: ["groq"],
  defaultProvider: "groq",
  providerModels: {
    groq: "llama-3.3-70b-versatile",
  },
  schema,
  pricing: {
    groq: {
      description: "~$0.001 per 1K tokens via Groq",
      calculate: () => 0.005, // typical request ~5K tokens
      minUsd: 0.001,
      maxUsd: 0.01,
    },
  },
};

export default definition;
