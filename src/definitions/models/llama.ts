/**
 * Llama LLM model
 * Fast inference via Groq
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "llama",
  description: "Meta Llama model for fast text generation via Groq",
  providers: ["groq"],
  defaultProvider: "groq",
  providerModels: {
    groq: "llama-3.3-70b-versatile",
  },
  schema: {
    input: {
      type: "object",
      required: ["messages"],
      properties: {
        messages: {
          type: "array",
          description: "Chat messages array",
        },
        model: {
          type: "string",
          enum: [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama-3.1-70b-versatile",
          ],
          default: "llama-3.3-70b-versatile",
          description: "Llama model variant",
        },
        temperature: {
          type: "number",
          default: 1,
          description: "Sampling temperature",
        },
        max_tokens: {
          type: "integer",
          default: 1024,
          description: "Maximum output tokens",
        },
        stream: {
          type: "boolean",
          default: false,
          description: "Stream response",
        },
      },
    },
    output: {
      type: "string",
      description: "Generated text response",
    },
  },
};

export default definition;
