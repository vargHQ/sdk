/**
 * Groq provider for varg SDK v2
 * Supports transcription models (Whisper)
 */

import Groq from "groq-sdk";
import type { ZodSchema } from "zod";
import { GROQ_TRANSCRIPTION_SCHEMAS } from "../schemas";
import type {
  ProviderSettings,
  TranscribeOptions,
  TranscribeResult,
  TranscriptionModel,
} from "../types";

const TRANSCRIPTION_MODELS: Record<string, string> = {
  whisper: "whisper-large-v3",
  "whisper-large-v3": "whisper-large-v3",
  "whisper-large-v3-turbo": "whisper-large-v3-turbo",
};

function resolveModelId(modelId: string): string {
  if (TRANSCRIPTION_MODELS[modelId]) {
    return TRANSCRIPTION_MODELS[modelId];
  }
  return modelId;
}

async function loadAudioFile(input: string | ArrayBuffer): Promise<File> {
  if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const response = await fetch(input);
      const buffer = await response.arrayBuffer();
      return new File([buffer], "audio.mp3", { type: "audio/mpeg" });
    }
    const file = Bun.file(input);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${input}`);
    }
    const buffer = await file.arrayBuffer();
    const name = input.split("/").pop() || "audio.mp3";
    return new File([buffer], name, { type: file.type || "audio/mpeg" });
  }
  return new File([input], "audio.mp3", { type: "audio/mpeg" });
}

class GroqTranscriptionModel implements TranscriptionModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "groq";
  readonly type = "transcription" as const;
  readonly modelId: string;

  private settings: GroqProviderSettings;
  private client: Groq;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: GroqProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.client = new Groq({
      apiKey: settings.apiKey || process.env.GROQ_API_KEY || "",
    });
    this.schema = GROQ_TRANSCRIPTION_SCHEMAS[modelId];
  }

  async doTranscribe(options: TranscribeOptions): Promise<TranscribeResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as TranscribeOptions;
    const { audio, language, prompt, providerOptions } = validated;

    const model = resolveModelId(this.modelId);
    const file = await loadAudioFile(audio);

    console.log(`[groq] transcribing with ${model}...`);

    const response = await this.client.audio.transcriptions.create({
      file: file as unknown as Parameters<
        typeof this.client.audio.transcriptions.create
      >[0]["file"],
      model,
      language,
      prompt,
      response_format: "verbose_json",
      ...(providerOptions?.groq ?? {}),
    });

    console.log(`[groq] transcription completed`);

    type VerboseResponse = {
      text: string;
      segments?: Array<{ start: number; end: number; text: string }>;
      language?: string;
      duration?: number;
    };

    const verboseResponse = response as VerboseResponse;

    return {
      text: verboseResponse.text,
      segments: (verboseResponse.segments ?? []).map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      language: verboseResponse.language,
      duration: verboseResponse.duration,
    };
  }
}

export interface GroqProviderSettings extends ProviderSettings {}

export interface GroqProvider {
  transcription(modelId?: string): TranscriptionModel;
}

export function createGroq(settings: GroqProviderSettings = {}): GroqProvider {
  return {
    transcription(modelId = "whisper-large-v3") {
      return new GroqTranscriptionModel(modelId, settings);
    },
  };
}

export const groq_provider = createGroq();

export { groq_provider as groq };
