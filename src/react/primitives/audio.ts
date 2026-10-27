/**
 * Audio pipeline — re-exports from focused modules.
 *
 * Historically a single file; now split into:
 * - `extract.ts` — audio extraction from video (ffmpeg -vn)
 * - `silence.ts` — silence detection + sound bounds
 * - `transcribe.ts` — Groq Whisper transcription with caching
 *
 * This barrel preserves the existing import paths.
 */

export { extractAudio } from "./extract";
export {
  computeSoundBounds,
  detectSilence,
  type RefineWordTimingsOptions,
  refineWordTimings,
  type SilenceDetectOptions,
  type TimeRange,
} from "./silence";
export {
  alignWordsToActivity,
  detectSpeechActivity,
  invertSilences,
  mergeActivity,
  type SpeechActivityOptions,
} from "./speech-activity";
export {
  extractWordTimings,
  type TranscriptionResult,
  transcribeAudio,
} from "./transcribe";
