/**
 * ElevenLabs provider for varg SDK v2
 * Supports TTS (text-to-speech) models
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ZodSchema } from "zod";
import { ELEVENLABS_TTS_SCHEMAS } from "../schemas";
import {
  MediaResult,
  type ProviderSettings,
  type TTSGenerateOptions,
  type TTSGenerateResult,
  type TTSModel,
} from "../types";

// ============================================================================
// Voice ID mappings (friendly -> raw)
// ============================================================================

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
};

// ============================================================================
// Helper functions
// ============================================================================

function resolveVoiceId(voice: string): string {
  // check friendly name (case insensitive)
  const lower = voice.toLowerCase();
  if (VOICES[lower]) {
    return VOICES[lower];
  }
  // assume it's already a voice ID
  return voice;
}

function resolveModelId(modelId: string): string {
  if (TTS_MODELS[modelId]) {
    return TTS_MODELS[modelId];
  }
  return modelId;
}

// ============================================================================
// ElevenLabs TTS Model
// ============================================================================

class ElevenLabsTTSModel implements TTSModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "elevenlabs";
  readonly type = "tts" as const;
  readonly modelId: string;

  private settings: ElevenLabsProviderSettings;
  private _client: ElevenLabsClient | null = null;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ElevenLabsProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.schema = ELEVENLABS_TTS_SCHEMAS[modelId];
  }

  private get client(): ElevenLabsClient {
    if (!this._client) {
      const apiKey = this.settings.apiKey || process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ElevenLabs API key not found. Set ELEVENLABS_API_KEY environment variable.",
        );
      }
      this._client = new ElevenLabsClient({ apiKey });
    }
    return this._client;
  }

  async doGenerate(options: TTSGenerateOptions): Promise<TTSGenerateResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as TTSGenerateOptions;
    const { text, voice, providerOptions } = validated;

    const voiceId = resolveVoiceId(voice ?? "rachel");
    const model = resolveModelId(this.modelId);

    console.log(`[elevenlabs] generating speech with voice ${voiceId}...`);

    const audio = await this.client.textToSpeech.convert(voiceId, {
      text,
      modelId: model,
      outputFormat: "mp3_44100_128",
      ...(providerOptions?.elevenlabs ?? {}),
    });

    // read stream to buffer
    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    console.log(`[elevenlabs] generated ${buffer.length} bytes`);

    // create a data URL for the audio since ElevenLabs doesn't give us a hosted URL
    const base64 = buffer.toString("base64");
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    // create MediaResult - for ElevenLabs we use a custom subclass that holds the buffer
    const result = new ElevenLabsMediaResult(dataUrl, "audio/mpeg", buffer);

    return {
      audio: result,
    };
  }
}

// ============================================================================
// Custom MediaResult for ElevenLabs (has buffer already)
// ============================================================================

class ElevenLabsMediaResult extends MediaResult {
  private _cachedBuffer: ArrayBuffer;

  constructor(url: string, mimeType: string, buffer: Buffer) {
    super(url, mimeType);
    // copy to a new ArrayBuffer to avoid SharedArrayBuffer issues
    this._cachedBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(this._cachedBuffer).set(new Uint8Array(buffer));
  }

  override async buffer(): Promise<ArrayBuffer> {
    return this._cachedBuffer;
  }
}

// ============================================================================
// Provider Settings
// ============================================================================

export interface ElevenLabsProviderSettings extends ProviderSettings {
  defaultVoice?: string;
}

// ============================================================================
// Provider Factory
// ============================================================================

export interface ElevenLabsProvider {
  tts(modelId?: string): TTSModel;
}

export function createElevenLabs(
  settings: ElevenLabsProviderSettings = {},
): ElevenLabsProvider {
  return {
    tts(modelId = "eleven_multilingual_v2") {
      return new ElevenLabsTTSModel(modelId, settings);
    },
  };
}

// default instance
export const elevenlabs_provider = createElevenLabs();

// convenience export matching ai-sdk style
export { elevenlabs_provider as elevenlabs };

// export voice IDs for reference
export { VOICES };
