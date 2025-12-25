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
      musicLengthMs,
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

// Popular voices
export const VOICES = {
  RACHEL: "21m00Tcm4TlvDq8ikWAM",
  DOMI: "AZnzlk1XvdvUeBnXmlld",
  BELLA: "EXAVITQu4vr4xnSDxMaL",
  ANTONI: "ErXwobaYiN019PkySvjV",
  ELLI: "MF3mGyEYCl7XYWbV9V6O",
  JOSH: "TxGEqnHWrfWFTfGW9XjX",
  ARNOLD: "VR6AewLTigWG4xSOukaG",
  ADAM: "pNInz6obpgDQGcFmaJgB",
  SAM: "yoZ06aMxZJJ28mfd3POQ",
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
