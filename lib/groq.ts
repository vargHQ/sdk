#!/usr/bin/env bun

/**
 * groq api wrapper for ultra-fast llm inference
 * supports llama, mixtral, gemma models with blazing fast speeds
 */

import Groq from "groq-sdk";
import type { Uploadable } from "groq-sdk/uploads";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// types
export interface ChatCompletionOptions {
  model?: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface TranscriptionOptions {
  file: Uploadable;
  model?: string;
  language?: string;
  prompt?: string;
  temperature?: number;
}

// popular models
export const GROQ_MODELS = {
  // llama models (meta)
  LLAMA_90B: "llama-3.3-70b-versatile",
  LLAMA_8B: "llama-3.1-8b-instant",
  LLAMA_70B: "llama-3.1-70b-versatile",

  // mixtral models (mistral)
  MIXTRAL_8X7B: "mixtral-8x7b-32768",

  // gemma models (google)
  GEMMA_7B: "gemma-7b-it",
  GEMMA_2_9B: "gemma2-9b-it",

  // whisper for audio transcription
  WHISPER_LARGE: "whisper-large-v3",
};

// core functions
export async function chatCompletion(options: ChatCompletionOptions) {
  const {
    model = GROQ_MODELS.LLAMA_90B,
    messages,
    temperature = 1,
    maxTokens = 1024,
    stream = false,
  } = options;

  if (!messages || messages.length === 0) {
    throw new Error("messages array is required");
  }

  console.log(`[groq] chat completion with ${model}...`);

  try {
    if (stream) {
      const streamResponse = await groq.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
      console.log(`[groq] streaming response...`);
      return streamResponse;
    }

    const response = await groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    const content = response.choices[0]?.message?.content || "";
    console.log(`[groq] completed (${response.usage?.total_tokens} tokens)`);
    return content;
  } catch (error) {
    console.error(`[groq] error:`, error);
    throw error;
  }
}

export async function transcribeAudio(options: TranscriptionOptions) {
  const {
    file,
    model = GROQ_MODELS.WHISPER_LARGE,
    language,
    prompt,
    temperature,
  } = options;

  if (!file) {
    throw new Error("file is required");
  }

  console.log(`[groq] transcribing audio with ${model}...`);

  try {
    const response = await groq.audio.transcriptions.create({
      file,
      model,
      language,
      prompt,
      temperature,
    });

    console.log(`[groq] transcription completed`);
    return response.text;
  } catch (error) {
    console.error(`[groq] error:`, error);
    throw error;
  }
}

export async function listModels() {
  console.log(`[groq] fetching available models...`);

  try {
    const response = await groq.models.list();
    const models = Array.from(response.data);
    console.log(`[groq] found ${models.length} models`);
    return models;
  } catch (error) {
    console.error(`[groq] error:`, error);
    throw error;
  }
}

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run lib/groq.ts <command> [args]

commands:
  chat <prompt> [model]              chat completion
  stream <prompt> [model]            streaming chat completion
  models                             list available models
  help                               show this help

examples:
  bun run lib/groq.ts chat "explain quantum computing"
  bun run lib/groq.ts chat "write a haiku about cats" llama-3.1-8b-instant
  bun run lib/groq.ts stream "tell me a story"
  bun run lib/groq.ts models

popular models:
  llama-3.3-70b-versatile    - meta llama 3.3 70b (best quality)
  llama-3.1-8b-instant       - meta llama 3.1 8b (fastest)
  llama-3.1-70b-versatile    - meta llama 3.1 70b
  mixtral-8x7b-32768         - mistral mixtral 8x7b
  gemma2-9b-it               - google gemma 2 9b
  whisper-large-v3           - openai whisper (audio transcription)

environment:
  GROQ_API_KEY - your groq api key
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "chat": {
        const prompt = args[1];
        const model = args[2];

        if (!prompt) {
          throw new Error("prompt is required");
        }

        const response = await chatCompletion({
          model: model || GROQ_MODELS.LLAMA_90B,
          messages: [{ role: "user", content: prompt }],
        });

        console.log(`\n${response}\n`);
        break;
      }

      case "stream": {
        const prompt = args[1];
        const model = args[2];

        if (!prompt) {
          throw new Error("prompt is required");
        }

        const stream = await chatCompletion({
          model: model || GROQ_MODELS.LLAMA_90B,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        });

        console.log("");
        for await (const chunk of stream as AsyncIterable<{
          choices: Array<{ delta: { content?: string } }>;
        }>) {
          const content = chunk.choices[0]?.delta?.content || "";
          process.stdout.write(content);
        }
        console.log("\n");
        break;
      }

      case "models": {
        const models = await listModels();
        console.log(
          `\navailable models:\n${models.map((m) => `  ${m.id} - ${m.owned_by}`).join("\n")}\n`,
        );
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run lib/groq.ts help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[groq] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
