/**
 * 60db provider for voice generation, text-to-speech, and speech-to-text.
 *
 * 60db has no official SDK, so this provider talks to the REST API directly:
 *   - POST /tts-synthesize  → JSON { audio_base64, sample_rate, duration_seconds }
 *   - GET  /myvoices        → JSON { data: Voice[] }
 *   - POST /stt             → multipart, JSON transcript with word timestamps
 *
 * Mirrors {@link ../providers/elevenlabs.ElevenLabsProvider} so the two
 * speech providers are interchangeable behind the `voice` action.
 */

import { writeFileSync } from "node:fs";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

const BASE_URL = "https://api.60db.ai";

/** A voice as returned by GET /myvoices. */
export interface SixtyDBVoice {
  voice_id: string;
  name: string;
  category?: string;
  model?: string;
  labels?: {
    language?: string;
    language_name?: string;
    gender?: string;
    accent?: string;
  };
  description?: string | null;
  is_native?: boolean;
  available_for_tiers?: unknown[];
  categories?: unknown[];
}

/** A single transcribed word with timing (from POST /stt, return_timestamps=word). */
export interface SixtyDBWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

/** Parsed response from POST /stt. */
export interface SixtyDBTranscript {
  request_id?: string;
  text: string;
  language?: string;
  language_name?: string;
  duration_sec?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
    words?: SixtyDBWord[];
    speakers?: Array<{ speaker: string }>;
  }>;
  words?: SixtyDBWord[];
  warnings?: unknown[];
}

/** True if the string looks like a 60db voice_id (UUID), not a friendly name. */
function isVoiceId(voice: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    voice,
  );
}

export class SixtyDBProvider extends BaseProvider {
  readonly name = "60db";
  private _voiceCache: SixtyDBVoice[] | null = null;

  /**
   * Resolve the API key lazily so importing the provider never throws when the
   * key is absent (matches the ElevenLabs provider's behaviour).
   */
  private get apiKey(): string {
    const apiKey = this.config.apiKey || process.env.SIXTYDB_API_KEY;
    if (!apiKey) {
      throw new Error(
        "60db API key not found. Set SIXTYDB_API_KEY environment variable.",
      );
    }
    return apiKey;
  }

  // ============================================================================
  // Provider interface — 60db is synchronous, so the job lifecycle is stubbed
  // exactly like the ElevenLabs provider. Real work happens in the high-level
  // convenience methods below.
  // ============================================================================

  async submit(
    _model: string,
    _inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const jobId = `db60_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(`[60db] starting generation: ${jobId}`);
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

  /**
   * Resolve a friendly voice name (e.g. "rachel") to a 60db voice_id by
   * matching against the account's voices. UUIDs pass through untouched.
   * Returns undefined when no name is given (server picks its default).
   */
  async resolveVoiceId(voice?: string): Promise<string | undefined> {
    if (!voice) return undefined;
    if (isVoiceId(voice)) return voice;

    const voices = await this.listVoices();
    const match = voices.find(
      (v) => v.name.toLowerCase() === voice.toLowerCase(),
    );
    // Fall back to passing the raw value through — lets unknown ids still work.
    return match?.voice_id ?? voice;
  }

  async textToSpeech(options: {
    text: string;
    voiceId?: string;
    voice?: string;
    speed?: number;
    stability?: number;
    similarity?: number;
    enhance?: boolean;
    outputFormat?: "mp3" | "wav" | "ogg" | "flac";
    outputPath?: string;
  }): Promise<Buffer> {
    const {
      text,
      voiceId,
      voice,
      speed,
      stability,
      similarity,
      enhance,
      outputFormat = "mp3",
      outputPath,
    } = options;

    const resolvedVoiceId = voiceId ?? (await this.resolveVoiceId(voice));

    console.log(
      `[60db] generating speech${
        resolvedVoiceId ? ` with voice ${resolvedVoiceId}` : ""
      }...`,
    );

    const response = await fetch(`${BASE_URL}/tts-synthesize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        ...(resolvedVoiceId ? { voice_id: resolvedVoiceId } : {}),
        ...(speed != null ? { speed } : {}),
        ...(stability != null ? { stability } : {}),
        ...(similarity != null ? { similarity } : {}),
        ...(enhance != null ? { enhance } : {}),
        output_format: outputFormat,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`60db TTS failed (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as {
      success: boolean;
      message?: string;
      audio_base64: string;
    };

    if (!json.success || !json.audio_base64) {
      throw new Error(`60db TTS error: ${json.message ?? "no audio returned"}`);
    }

    const buffer = Buffer.from(json.audio_base64, "base64");

    if (outputPath) {
      writeFileSync(outputPath, buffer);
      console.log(`[60db] saved to ${outputPath}`);
    }

    console.log(`[60db] generated ${buffer.length} bytes`);
    return buffer;
  }

  async listVoices(): Promise<SixtyDBVoice[]> {
    if (this._voiceCache) return this._voiceCache;

    console.log(`[60db] fetching voices...`);
    const response = await fetch(`${BASE_URL}/myvoices`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `60db list voices failed (${response.status}): ${errorText}`,
      );
    }

    const json = (await response.json()) as {
      success: boolean;
      data: SixtyDBVoice[];
    };
    this._voiceCache = json.data ?? [];
    console.log(`[60db] found ${this._voiceCache.length} voices`);
    return this._voiceCache;
  }

  async getVoice(voiceId: string): Promise<SixtyDBVoice | undefined> {
    const voices = await this.listVoices();
    return voices.find((v) => v.voice_id === voiceId);
  }

  /**
   * Speech-to-text via POST /stt (multipart). Returns the parsed transcript,
   * including word-level timestamps when `returnTimestamps` is "word".
   *
   * @param audio Local file path, http(s) URL, or a Buffer/ArrayBuffer.
   */
  async speechToText(options: {
    audio: string | Buffer | ArrayBuffer | Uint8Array;
    language?: string;
    diarize?: boolean;
    returnTimestamps?: "none" | "word";
    includeConfidence?: boolean;
    fileName?: string;
  }): Promise<SixtyDBTranscript> {
    const {
      audio,
      language,
      diarize,
      returnTimestamps = "word",
      includeConfidence,
      fileName = "audio.mp3",
    } = options;

    let bytes: ArrayBuffer | Uint8Array;
    let name = fileName;

    if (typeof audio === "string") {
      if (audio.startsWith("http://") || audio.startsWith("https://")) {
        const res = await fetch(audio);
        bytes = await res.arrayBuffer();
      } else {
        const file = Bun.file(audio);
        bytes = await file.arrayBuffer();
        name = audio.split(/[/\\]/).pop() || fileName;
      }
    } else {
      bytes = audio;
    }

    const form = new FormData();
    form.append("file", new Blob([bytes]), name);
    if (language) form.append("language", language);
    if (diarize != null) form.append("diarize", String(diarize));
    form.append("return_timestamps", returnTimestamps);
    if (includeConfidence != null)
      form.append("include_confidence", String(includeConfidence));

    console.log(`[60db] transcribing ${name}...`);
    const response = await fetch(`${BASE_URL}/stt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`60db STT failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as SixtyDBTranscript;
  }
}

// Export singleton instance (lazy initialization means no error on import)
export const sixtyDbProvider = new SixtyDBProvider();

// Re-export convenience functions for parity with the ElevenLabs provider.
export const textToSpeech = (
  options: Parameters<SixtyDBProvider["textToSpeech"]>[0],
) => sixtyDbProvider.textToSpeech(options);
export const listVoices = () => sixtyDbProvider.listVoices();
export const getVoice = (voiceId: string) => sixtyDbProvider.getVoice(voiceId);
export const speechToText = (
  options: Parameters<SixtyDBProvider["speechToText"]>[0],
) => sixtyDbProvider.speechToText(options);
