import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
  type SpeechModelV3,
  type SpeechModelV3CallOptions,
} from "@ai-sdk/provider";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { MusicModelV3, MusicModelV3CallOptions } from "./music-model";

const VOICES: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  domi: "AZnzlk1XvdvUeBnXmlld",
  bella: "EXAVITQu4vr4xnSDxMaL",
  antoni: "ErXwobaYiN019PkySvjV",
  elli: "MF3mGyEYCl7XYWbV9V6O",
  josh: "TxGEqnHWrfWFTfGW9XjX",
  arnold: "VR6AewLTigWG4xSOukaG",
  adam: "pNInz6obpgDQGcFmaJgB",
  sam: "yoZ06aMxZJJ28mfd3POQ",
};

const TTS_MODELS: Record<string, string> = {
  eleven_multilingual_v2: "eleven_multilingual_v2",
  eleven_turbo_v2: "eleven_turbo_v2",
  eleven_monolingual_v1: "eleven_monolingual_v1",
  multilingual_v2: "eleven_multilingual_v2",
  turbo_v2: "eleven_turbo_v2",
  turbo: "eleven_turbo_v2",
};

function resolveVoiceId(voice: string): string {
  const lower = voice.toLowerCase();
  return VOICES[lower] ?? voice;
}

function resolveModelId(modelId: string): string {
  return TTS_MODELS[modelId] ?? modelId;
}

class ElevenLabsMusicModel implements MusicModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "elevenlabs";
  readonly modelId: string;

  private client: ElevenLabsClient;

  constructor(modelId: string, client: ElevenLabsClient) {
    this.modelId = modelId;
    this.client = client;
  }

  async doGenerate(options: MusicModelV3CallOptions) {
    const { prompt, duration, providerOptions } = options;
    const warnings: SharedV3Warning[] = [];

    const elevenLabsOptions = providerOptions?.elevenlabs ?? {};
    const audio = await this.client.music.compose({
      prompt,
      musicLengthMs: duration ? duration * 1000 : undefined,
      modelId: this.modelId,
      ...elevenLabsOptions,
    } as Parameters<typeof this.client.music.compose>[0]);

    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      audio: result,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

class ElevenLabsSpeechModel implements SpeechModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "elevenlabs";
  readonly modelId: string;

  private client: ElevenLabsClient;

  constructor(modelId: string, client: ElevenLabsClient) {
    this.modelId = modelId;
    this.client = client;
  }

  async doGenerate(options: SpeechModelV3CallOptions) {
    const { text, voice, outputFormat, speed, providerOptions } = options;
    const warnings: SharedV3Warning[] = [];

    const voiceId = resolveVoiceId(voice ?? "rachel");
    const model = resolveModelId(this.modelId);

    if (speed !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "speed",
        details: "Speed control requires voice settings adjustment",
      });
    }

    const elevenLabsOptions = providerOptions?.elevenlabs ?? {};
    const audio = await this.client.textToSpeech.convert(voiceId, {
      text,
      modelId: model,
      outputFormat: "mp3_44100_128",
      ...elevenLabsOptions,
    } as Parameters<typeof this.client.textToSpeech.convert>[1]);

    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      audio: result,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

export interface ElevenLabsProviderSettings {
  apiKey?: string;
}

export interface ElevenLabsProvider extends ProviderV3 {
  speechModel(modelId?: string): SpeechModelV3;
  musicModel(modelId?: string): MusicModelV3;
}

export function createElevenLabs(
  settings: ElevenLabsProviderSettings = {},
): ElevenLabsProvider {
  const apiKey = settings.apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not set");
  }
  const client = new ElevenLabsClient({ apiKey });

  return {
    specificationVersion: "v3",
    speechModel(modelId = "eleven_turbo_v2") {
      return new ElevenLabsSpeechModel(modelId, client);
    },
    musicModel(modelId = "music_v1") {
      return new ElevenLabsMusicModel(modelId, client);
    },
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
    imageModel(modelId: string): ImageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "imageModel" });
    },
  };
}

export const elevenlabs_provider = createElevenLabs();
export { elevenlabs_provider as elevenlabs, VOICES };

export interface GenerateMusicOptions {
  prompt: string;
  durationSeconds?: number;
  apiKey?: string;
}

export interface GenerateMusicResult {
  audio: {
    uint8Array: Uint8Array;
    mimeType: string;
  };
}

export async function generateMusic(
  options: GenerateMusicOptions,
): Promise<GenerateMusicResult> {
  const { prompt, durationSeconds, apiKey } = options;
  const key = apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY not set");
  }

  const client = new ElevenLabsClient({ apiKey: key });

  const audio = await client.music.compose({
    prompt,
    musicLengthMs: durationSeconds ? durationSeconds * 1000 : undefined,
    modelId: "music_v1",
  });

  const reader = audio.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    audio: {
      uint8Array: result,
      mimeType: "audio/mpeg",
    },
  };
}
