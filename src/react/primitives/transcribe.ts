/**
 * Audio transcription — Groq Whisper word-level transcription with caching.
 *
 * Used by `AudioNode.transcribe()`, the captions renderer, and the
 * standalone resolve path.
 */

import { groq } from "@ai-sdk/groq";
import { experimental_transcribe as transcribe } from "ai";
import type { CacheStorage } from "../../ai-sdk/cache";
import type { File } from "../../ai-sdk/file";
import type { WordTiming } from "../../speech/types";
import { getActiveLimit, getResolveContext } from "../resolve-context";

export interface TranscriptionResult {
  text: string;
  words: WordTiming[];
}

/** Raw word shape from Groq / gateway response. */
interface RawWord {
  word: string;
  start: number;
  end: number;
}

/** Stable identity for audio content used in transcription cache keys.
 *  Content hash — upload URLs contain Date.now()+random and would make
 *  keys non-deterministic (same reasoning as computeCacheKey). */
function contentCacheIdentity(bytes: Uint8Array): string {
  return `h${Bun.hash(bytes).toString(36)}:${bytes.byteLength}`;
}

/**
 * Extract word-level timings from a transcription result.
 *
 * Words may come from two places depending on the model path:
 * 1. `providerMetadata.varg.words` — gateway models route through the varg API
 * 2. `response.body.words` — direct Groq calls return words in the response body
 *
 * Shared between `transcribeAudio()` and the captions renderer to avoid
 * duplicate extraction logic.
 */
export function extractWordTimings(result: {
  providerMetadata?: { varg?: { words?: RawWord[] } };
  responses?: unknown[];
}): WordTiming[] {
  const metaWords = result.providerMetadata?.varg?.words;
  if (metaWords && metaWords.length > 0) {
    return metaWords.map((w) => ({ word: w.word, start: w.start, end: w.end }));
  }

  const rawBody = (result.responses?.[0] as { body?: unknown } | undefined)
    ?.body;
  const bodyWords = (rawBody as { words?: RawWord[] } | undefined)?.words;
  if (Array.isArray(bodyWords)) {
    return bodyWords
      .filter(
        (w) =>
          typeof w?.word === "string" &&
          typeof w?.start === "number" &&
          typeof w?.end === "number",
      )
      .map((w) => ({ word: w.word, start: w.start, end: w.end }));
  }

  return [];
}

/**
 * Transcribe an audio file to `{ text, words }` with word-level timestamps.
 *
 * Uses the gateway transcription model from render defaults when available,
 * falling back to direct Groq `whisper-large-v3`. Results are cached by
 * audio content hash in the active cache storage.
 */
export async function transcribeAudio(
  file: File,
  options: {
    cache?: CacheStorage;
    model?: Parameters<typeof transcribe>[0]["model"];
    /** Context hint for Whisper — names, terms, domain language. */
    prompt?: string;
  } = {},
): Promise<TranscriptionResult> {
  const ctx = getResolveContext();
  const cache = options.cache ?? ctx?.cache;
  const bytes = await file.arrayBuffer();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const model = options.model ?? groq.transcription("whisper-large-v3");
  const modelId =
    typeof model === "string"
      ? model
      : ((model as { modelId?: string }).modelId ?? "whisper");
  const promptKey = options.prompt
    ? `:p${Bun.hash(options.prompt).toString(36)}`
    : "";
  const cacheKey = `transcribeAudio:${modelId}:${contentCacheIdentity(data)}${promptKey}`;

  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached !== undefined) return cached as TranscriptionResult;
  }

  // Gateway models (passed explicitly via options.model) route through the
  // varg API and don't accept groq-specific providerOptions. Direct Groq
  // calls need responseFormat + timestampGranularities for word timings.
  const isGatewayModel = options.model !== undefined;
  // Cache miss — this is a real API call, so it takes a limiter slot.
  // transcribeAudio hand-rolls its cache instead of using withCache, so
  // the limit is applied here directly. Transcription was the third leg
  // of the ep5 fan-out: 12 async components => 12 parallel POSTs (sdk#225).
  const result = await getActiveLimit()(() =>
    transcribe({
      model,
      audio: data,
      providerOptions: isGatewayModel
        ? options.prompt
          ? { varg: { prompt: options.prompt } }
          : {}
        : {
            groq: {
              responseFormat: "verbose_json",
              timestampGranularities: ["word"],
              ...(options.prompt ? { prompt: options.prompt } : {}),
            },
          },
    }),
  );

  const words = extractWordTimings(result);
  const transcription: TranscriptionResult = { text: result.text, words };

  if (cache) {
    await cache.set(cacheKey, transcription);
  }
  return transcription;
}
