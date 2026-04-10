/**
 * ElevenLabs provider for voice generation and text-to-speech
 */

import { writeFileSync } from "node:fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export class ElevenLabsProvider extends BaseProvider {
  readonly name = "elevenlabs";
  private _client: ElevenLabsClient | null = null;

  /**
   * Lazy initialization of the client to avoid errors when API keys aren't set
   */
  private get client(): ElevenLabsClient {
    if (!this._client) {
      const apiKey = this.config.apiKey || process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ElevenLabs API key not found. Set ELEVENLABS_API_KEY environment variable.",
        );
      }
      this._client = new ElevenLabsClient({ apiKey });
    }
    return this._client;
  }

  async submit(
    _model: string,
    _inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    // ElevenLabs is synchronous, so we generate immediately and return a fake ID
    const jobId = `el_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(`[elevenlabs] starting generation: ${jobId}`);
    return jobId;
  }

  async getStatus(_jobId: string): Promise<JobStatusUpdate> {
    // ElevenLabs is synchronous
    return { status: "completed" };
  }

  async getResult(_jobId: string): Promise<unknown> {
    return null;
  }

  // ============================================================================
  // High-level convenience methods
  // ============================================================================

  async textToSpeech(options: {
    text: string;
    voiceId?: string;
    modelId?: string;
    outputPath?: string;
  }): Promise<Buffer> {
    const {
      text,
      voiceId = VOICES.RACHEL,
      modelId = "eleven_multilingual_v2",
      outputPath,
    } = options;

    console.log(`[elevenlabs] generating speech with voice ${voiceId}...`);

    const audio = await this.client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: "mp3_44100_128",
    });

    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    if (outputPath) {
      writeFileSync(outputPath, buffer);
      console.log(`[elevenlabs] saved to ${outputPath}`);
    }

    console.log(`[elevenlabs] generated ${buffer.length} bytes`);
    return buffer;
  }

  async listVoices() {
    console.log(`[elevenlabs] fetching voices...`);
    const response = await this.client.voices.getAll();
    console.log(`[elevenlabs] found ${response.voices.length} voices`);
    return response.voices;
  }

  async getVoice(voiceId: string) {
    console.log(`[elevenlabs] fetching voice ${voiceId}...`);
    const voice = await this.client.voices.get(voiceId);
    console.log(`[elevenlabs] found voice: ${voice.name}`);
    return voice;
  }

  async generateMusic(options: {
    prompt: string;
    musicLengthMs?: number;
    outputPath?: string;
  }): Promise<Buffer> {
    const { prompt, musicLengthMs, outputPath } = options;

    console.log(`[elevenlabs] generating music from prompt: "${prompt}"...`);

    const audio = await this.client.music.compose({
      prompt,
      musicLengthMs:
        musicLengthMs != null ? Math.round(musicLengthMs) : undefined,
      modelId: "music_v1",
    });

    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    if (outputPath) {
      writeFileSync(outputPath, buffer);
      console.log(`[elevenlabs] saved to ${outputPath}`);
    }

    console.log(`[elevenlabs] generated ${buffer.length} bytes`);
    return buffer;
  }

  async generateSoundEffect(options: {
    text: string;
    durationSeconds?: number;
    promptInfluence?: number;
    loop?: boolean;
    outputPath?: string;
  }): Promise<Buffer> {
    const {
      text,
      durationSeconds,
      promptInfluence = 0.3,
      loop = false,
      outputPath,
    } = options;

    console.log(`[elevenlabs] generating sound effect: "${text}"...`);

    const audio = await this.client.textToSoundEffects.convert({
      text,
      durationSeconds,
      promptInfluence,
      loop,
    });

    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    if (outputPath) {
      writeFileSync(outputPath, buffer);
      console.log(`[elevenlabs] saved to ${outputPath}`);
    }

    console.log(`[elevenlabs] generated ${buffer.length} bytes`);
    return buffer;
  }
}

/**
 * Curated voice_id constants for common ElevenLabs voices.
 * For the full catalog of 600+ voices, use voice_ids directly or
 * call the gateway's GET /v1/voices endpoint to browse/search.
 */
export const VOICES = {
  // Current ElevenLabs premade voices (source: skills/varg-ai/references/models.md)
  ADAM: "pNInz6obpgDQGcFmaJgB",
  ALICE: "Xb7hH8MSUJpSbSDYk0k2",
  BELLA: "hpp4J3VqNfWAUOO0d1Us",
  BILL: "pqHfZKP75CvOlQylNhV4",
  BRIAN: "nPczCjzI2devNBz1zQrb",
  CALLUM: "N2lVS1w4EtoT3dr4eOWO",
  CHARLIE: "IKne3meq5aSn9XLyUdCD",
  CHRIS: "iP95p4xoKVk53GoZ742B",
  DANIEL: "onwK4e9ZLuTAKqWW03F9",
  ERIC: "cjVigY5qzO86Huf0OWal",
  GEORGE: "JBFqnCBsd6RMkjVDRZzb",
  HARRY: "SOYHLrjzK2X1ezoPC6cr",
  JESSICA: "cgSgspJ2msm6clMCkdW9",
  LAURA: "FGY2WhTYpPnrIDTdsKH5",
  LIAM: "TX3LPaxmHKxFdv7VOQHJ",
  LILY: "pFZP5JQG7iQjIQuC4Bku",
  MATILDA: "XrExE9yKIg1WjnnlVkGX",
  RIVER: "SAz9YHcvj6GT2YYXdXww",
  ROGER: "CwhRBWXzGAHq8TQ4Fs17",
  SARAH: "EXAVITQu4vr4xnSDxMaL",
  WILL: "bIHbv24MWmeRgasZH58o",
  // Legacy
  RACHEL: "21m00Tcm4TlvDq8ikWAM",
};

// Export singleton instance (lazy initialization means no error on import)
export const elevenlabsProvider = new ElevenLabsProvider();

// Re-export convenience functions for backward compatibility
export const textToSpeech = (
  options: Parameters<ElevenLabsProvider["textToSpeech"]>[0],
) => elevenlabsProvider.textToSpeech(options);
export const listVoices = () => elevenlabsProvider.listVoices();
export const getVoice = (voiceId: string) =>
  elevenlabsProvider.getVoice(voiceId);
export const generateMusic = (
  options: Parameters<ElevenLabsProvider["generateMusic"]>[0],
) => elevenlabsProvider.generateMusic(options);
export const generateSoundEffect = (
  options: Parameters<ElevenLabsProvider["generateSoundEffect"]>[0],
) => elevenlabsProvider.generateSoundEffect(options);
