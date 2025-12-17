/**
 * Groq provider for ultra-fast LLM inference
 * Supports Llama, Mixtral, Gemma models and Whisper transcription
 */

import Groq from "groq-sdk";
import type { Uploadable } from "groq-sdk/uploads";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export class GroqProvider extends BaseProvider {
  readonly name = "groq";
  private client: Groq;

  constructor(config?: ProviderConfig) {
    super(config);
    this.client = new Groq({
      apiKey: config?.apiKey || process.env.GROQ_API_KEY || "",
    });
  }

  async submit(
    _model: string,
    _inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    // Groq is synchronous for chat, so we generate a fake job ID
    const jobId = `groq_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(`[groq] starting inference: ${jobId}`);
    return jobId;
  }

  async getStatus(_jobId: string): Promise<JobStatusUpdate> {
    return { status: "completed" };
  }

  async getResult(_jobId: string): Promise<unknown> {
    return null;
  }

  // ============================================================================
  // High-level convenience methods
  // ============================================================================

  async chatCompletion(options: {
    model?: string;
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }) {
    const {
      model = GROQ_MODELS.LLAMA_90B,
      messages,
      temperature = 1,
      maxTokens = 1024,
      stream = false,
    } = options;

    console.log(`[groq] chat completion with ${model}...`);

    if (stream) {
      const streamResponse = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
      console.log(`[groq] streaming response...`);
      return streamResponse;
    }

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    const content = response.choices[0]?.message?.content || "";
    console.log(`[groq] completed (${response.usage?.total_tokens} tokens)`);
    return content;
  }

  async transcribeAudio(options: {
    file: Uploadable;
    model?: string;
    language?: string;
    prompt?: string;
    temperature?: number;
  }) {
    const {
      file,
      model = GROQ_MODELS.WHISPER_LARGE,
      language,
      prompt,
      temperature,
    } = options;

    console.log(`[groq] transcribing audio with ${model}...`);

    const response = await this.client.audio.transcriptions.create({
      file,
      model,
      language,
      prompt,
      temperature,
    });

    console.log(`[groq] transcription completed`);
    return response.text;
  }

  async listModels() {
    console.log(`[groq] fetching available models...`);
    const response = await this.client.models.list();
    const models = Array.from(response.data);
    console.log(`[groq] found ${models.length} models`);
    return models;
  }
}

// Popular models
export const GROQ_MODELS = {
  LLAMA_90B: "llama-3.3-70b-versatile",
  LLAMA_8B: "llama-3.1-8b-instant",
  LLAMA_70B: "llama-3.1-70b-versatile",
  MIXTRAL_8X7B: "mixtral-8x7b-32768",
  GEMMA_7B: "gemma-7b-it",
  GEMMA_2_9B: "gemma2-9b-it",
  WHISPER_LARGE: "whisper-large-v3",
};

// Export singleton instance
export const groqProvider = new GroqProvider();

// Re-export convenience functions for backward compatibility
export const chatCompletion = (
  options: Parameters<GroqProvider["chatCompletion"]>[0],
) => groqProvider.chatCompletion(options);
export const transcribeAudio = (
  options: Parameters<GroqProvider["transcribeAudio"]>[0],
) => groqProvider.transcribeAudio(options);
export const listModels = () => groqProvider.listModels();
