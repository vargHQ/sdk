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
import {
  SixtyDBProvider as SixtyDBRestProvider,
  type SixtyDBWord,
} from "../../providers/60db";
import type { ElevenLabsCharacterAlignment } from "../../speech/types";

const BASE_URL = "https://api.60db.ai";

/**
 * 60db speech model for the Vercel AI SDK (used by the React/captions engine).
 *
 * 60db's TTS endpoint returns audio only — no character alignment — so word
 * timing (needed for captions and lip-sync) is recovered with an STT
 * round-trip and packed into `providerMetadata.sixtydb.alignment` using the
 * same {@link ElevenLabsCharacterAlignment} shape the engine already parses.
 *
 * The round-trip costs one extra API call. Disable it per call with
 * `providerOptions: { sixtydb: { timestamps: false } }`.
 */

/**
 * Expand word-level timings into a synthetic character-level alignment.
 * Characters within a word are spread evenly across its [start, end] span, with
 * a space inserted between words. `parseElevenLabsAlignment` regroups these back
 * into the original words, so captions/lip-sync behave identically to ElevenLabs.
 */
function wordsToCharacterAlignment(
  words: SixtyDBWord[],
): ElevenLabsCharacterAlignment {
  const characters: string[] = [];
  const startTimes: number[] = [];
  const endTimes: number[] = [];

  for (let w = 0; w < words.length; w++) {
    const { word, start, end } = words[w]!;
    const chars = Array.from(word);
    const span = Math.max(end - start, 0);
    const per = chars.length > 0 ? span / chars.length : 0;

    for (let i = 0; i < chars.length; i++) {
      characters.push(chars[i]!);
      startTimes.push(start + per * i);
      endTimes.push(start + per * (i + 1));
    }

    // Whitespace boundary between words (carries the inter-word gap timing).
    if (w < words.length - 1) {
      const next = words[w + 1]!;
      characters.push(" ");
      startTimes.push(end);
      endTimes.push(Math.max(next.start, end));
    }
  }

  return {
    characters,
    character_start_times_seconds: startTimes,
    character_end_times_seconds: endTimes,
  };
}

class SixtyDBSpeechModel implements SpeechModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "60db";
  readonly modelId: string;

  private apiKey: string;
  private rest: SixtyDBRestProvider;

  constructor(modelId: string, apiKey: string) {
    this.modelId = modelId;
    this.apiKey = apiKey;
    this.rest = new SixtyDBRestProvider({ apiKey });
  }

  async doGenerate(options: SpeechModelV3CallOptions) {
    const { text, voice, speed, providerOptions } = options;
    const warnings: SharedV3Warning[] = [];

    const sixtyOptions = (providerOptions?.sixtydb ?? {}) as Record<
      string,
      unknown
    >;
    const { timestamps, ...passthrough } = sixtyOptions;
    const deriveTimestamps = timestamps !== false;

    const voiceId = voice
      ? await this.rest.resolveVoiceId(voice)
      : undefined;

    const controller = new AbortController();
    const timeoutMs = 120_000; // 2 minutes — generous for long-form TTS
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/tts-synthesize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          ...(voiceId ? { voice_id: voiceId } : {}),
          ...(speed != null ? { speed } : {}),
          output_format: "mp3",
          ...passthrough,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          `60db speech timed out after ${timeoutMs / 1000}s`,
        );
      }
      throw error;
    }
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`60db speech failed (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as {
      success: boolean;
      message?: string;
      audio_base64: string;
    };

    if (!json.success || !json.audio_base64) {
      throw new Error(
        `60db speech error: ${json.message ?? "no audio returned"}`,
      );
    }

    const audioBytes = Buffer.from(json.audio_base64, "base64");
    const result = new Uint8Array(
      audioBytes.buffer,
      audioBytes.byteOffset,
      audioBytes.byteLength,
    );

    // Recover word timing via an STT round-trip and expose it in the same
    // shape ElevenLabs uses, namespaced under `sixtydb`.
    // biome-ignore lint/suspicious/noExplicitAny: matches JSONObject metadata
    let providerMetadata: Record<string, any> | undefined;
    if (deriveTimestamps) {
      try {
        const transcript = await this.rest.speechToText({
          audio: audioBytes,
          returnTimestamps: "word",
        });
        const words =
          transcript.words?.length
            ? transcript.words
            : (transcript.segments ?? []).flatMap((s) => s.words ?? []);

        if (words.length > 0) {
          const alignment = wordsToCharacterAlignment(words);
          providerMetadata = JSON.parse(
            JSON.stringify({ sixtydb: { alignment } }),
          );
        }
      } catch (error) {
        // Non-fatal: audio is still returned, just without word timing.
        console.warn(
          `[60db] timestamp recovery failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      audio: result,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
      },
      ...(providerMetadata != null ? { providerMetadata } : {}),
    };
  }
}

export interface SixtyDBProviderSettings {
  apiKey?: string;
}

/** Default model IDs used when callers omit the modelId argument. */
export const SIXTYDB_DEFAULTS = {
  speechModel: "60db-fast",
} as const;

export interface SixtyDBProvider extends ProviderV3 {
  speechModel(modelId?: string): SpeechModelV3;
}

export function createSixtyDB(
  settings: SixtyDBProviderSettings = {},
): SixtyDBProvider {
  const apiKey = settings.apiKey ?? process.env.SIXTYDB_API_KEY;
  if (!apiKey) {
    throw new Error("SIXTYDB_API_KEY not set");
  }

  return {
    specificationVersion: "v3",
    speechModel(modelId = SIXTYDB_DEFAULTS.speechModel) {
      return new SixtyDBSpeechModel(modelId, apiKey);
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

let _sixtydb: SixtyDBProvider | undefined;
export const sixtydb = new Proxy({} as SixtyDBProvider, {
  get(_, prop) {
    if (!_sixtydb) {
      _sixtydb = createSixtyDB();
    }
    return _sixtydb[prop as keyof SixtyDBProvider];
  },
});
