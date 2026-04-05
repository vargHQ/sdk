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
import type { ElevenLabsCharacterAlignment } from "../../speech/types";
import type { MusicModelV3, MusicModelV3CallOptions } from "../music-model";

/**
 * Curated name → voice_id mapping for backward-compatible friendly names.
 * These are convenience aliases only — any valid ElevenLabs voice_id can be
 * passed directly as the `voice` parameter and it will be forwarded as-is.
 *
 * For the full catalog of 600+ voices, use voice_id strings directly or
 * call the gateway's GET /v1/voices endpoint to browse/search.
 */
const VOICES: Record<string, string> = {
  // Current ElevenLabs premade voices (source: skills/varg-ai/references/models.md)
  adam: "pNInz6obpgDQGcFmaJgB",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  bella: "hpp4J3VqNfWAUOO0d1Us",
  bill: "pqHfZKP75CvOlQylNhV4",
  brian: "nPczCjzI2devNBz1zQrb",
  callum: "N2lVS1w4EtoT3dr4eOWO",
  charlie: "IKne3meq5aSn9XLyUdCD",
  chris: "iP95p4xoKVk53GoZ742B",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  eric: "cjVigY5qzO86Huf0OWal",
  george: "JBFqnCBsd6RMkjVDRZzb",
  harry: "SOYHLrjzK2X1ezoPC6cr",
  jessica: "cgSgspJ2msm6clMCkdW9",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
  lily: "pFZP5JQG7iQjIQuC4Bku",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  river: "SAz9YHcvj6GT2YYXdXww",
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  will: "bIHbv24MWmeRgasZH58o",
  // Legacy
  rachel: "21m00Tcm4TlvDq8ikWAM",
};

const TTS_MODELS: Record<string, string> = {
  // First-class model IDs (pass directly to ElevenLabs API)
  eleven_multilingual_v2: "eleven_multilingual_v2",
  eleven_v3: "eleven_v3",
  eleven_turbo_v2: "eleven_turbo_v2",
  eleven_turbo_v2_5: "eleven_turbo_v2_5",
  eleven_flash_v2: "eleven_flash_v2",
  eleven_flash_v2_5: "eleven_flash_v2_5",
  // Legacy aliases
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

  private apiKey: string;

  constructor(modelId: string, apiKey: string) {
    this.modelId = modelId;
    this.apiKey = apiKey;
  }

  async doGenerate(options: SpeechModelV3CallOptions) {
    const { text, voice, speed, providerOptions } = options;
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

    const elevenLabsOptions = (providerOptions?.elevenlabs ?? {}) as Record<
      string,
      unknown
    >;

    // Call the /with-timestamps endpoint via raw fetch.
    // Returns JSON with base64 audio + character-level alignment.
    const controller = new AbortController();
    const timeoutMs = 120_000; // 2 minutes — generous for long-form TTS
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: model,
            ...elevenLabsOptions,
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          `ElevenLabs speech timed out after ${timeoutMs / 1000}s for voice ${voiceId}`,
        );
      }
      throw error;
    }
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs speech with timestamps failed (${response.status}): ${errorText}`,
      );
    }

    const json = (await response.json()) as {
      audio_base64: string;
      alignment?: ElevenLabsCharacterAlignment;
      normalized_alignment?: ElevenLabsCharacterAlignment;
    };

    // Decode base64 audio to binary
    const audioBytes = Buffer.from(json.audio_base64, "base64");
    const result = new Uint8Array(
      audioBytes.buffer,
      audioBytes.byteOffset,
      audioBytes.byteLength,
    );

    // Pack alignment data into providerMetadata so the AI SDK passes it through.
    // biome-ignore lint/suspicious/noExplicitAny: JSON.parse returns any, matching JSONObject
    const providerMetadata: Record<string, any> | undefined = json.alignment
      ? JSON.parse(
          JSON.stringify({
            elevenlabs: {
              alignment: json.alignment,
              normalizedAlignment: json.normalized_alignment,
            },
          }),
        )
      : undefined;

    return {
      audio: result,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
      providerMetadata,
    };
  }
}

export interface ElevenLabsProviderSettings {
  apiKey?: string;
}

/** Default model IDs used when callers omit the modelId argument. */
export const ELEVENLABS_DEFAULTS = {
  speechModel: "eleven_turbo_v2",
  musicModel: "music_v1",
} as const;

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
    speechModel(modelId = ELEVENLABS_DEFAULTS.speechModel) {
      return new ElevenLabsSpeechModel(modelId, apiKey);
    },
    musicModel(modelId = ELEVENLABS_DEFAULTS.musicModel) {
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

let _elevenlabs: ElevenLabsProvider | undefined;
export const elevenlabs = new Proxy({} as ElevenLabsProvider, {
  get(_, prop) {
    if (!_elevenlabs) {
      _elevenlabs = createElevenLabs();
    }
    return _elevenlabs[prop as keyof ElevenLabsProvider];
  },
});
export { VOICES };

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
