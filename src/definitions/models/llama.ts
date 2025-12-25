/**
 * Llama LLM model
 * Fast inference via Groq
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const llamaInputSchema = z.object({
  messages: z.array(messageSchema).describe("Chat messages array"),
  model: z
    .enum([
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama-3.1-70b-versatile",
    ])
    .optional()
    .default("llama-3.3-70b-versatile")
    .describe("Llama model variant"),
  temperature: z
    .number()
    .optional()
    .default(1)
    .describe("Sampling temperature"),
  max_tokens: z
    .number()
    .int()
    .optional()
    .default(1024)
    .describe("Maximum output tokens"),
  stream: z.boolean().optional().default(false).describe("Stream response"),
});

export const llamaOutputSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    }),
  ),
});

export type LlamaInput = z.infer<typeof llamaInputSchema>;
export type LlamaOutput = z.infer<typeof llamaOutputSchema>;

export const definition: ModelDefinition<
  typeof llamaInputSchema,
  typeof llamaOutputSchema
> = {
  type: "model",
  name: "llama",
  description: "Meta Llama model for fast text generation via Groq",
  providers: ["groq"],
  defaultProvider: "groq",
  providerModels: {
    groq: "llama-3.3-70b-versatile",
  },
  inputSchema: llamaInputSchema,
  outputSchema: llamaOutputSchema,
};

export default definition;
