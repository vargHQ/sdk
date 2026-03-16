/**
 * Integration test: resolve context with real Rendi backend.
 *
 * Verifies that `await Speech()` inside `withResolveContext` uses
 * the Rendi (cloud) backend for ffprobe instead of local ffprobe.
 *
 * Requires RENDI_API_KEY and FAL_KEY env vars.
 * Run: bun test src/react/resolve-context-rendi.test.ts
 */
import { describe, expect, test } from "bun:test";
import { createRendiBackend } from "../ai-sdk/providers/editly/rendi";
import { elevenlabs } from "../ai-sdk/providers/elevenlabs";
import { falStorage } from "../ai-sdk/storage/fal";
import { Speech } from "./elements";
import { withResolveContext } from "./resolve-context";
import { ResolvedElement } from "./resolved-element";

const hasRendiKey = !!process.env.RENDI_API_KEY;
const hasFalKey = !!process.env.FAL_KEY;
const canRun = hasRendiKey && hasFalKey;

describe.skipIf(!canRun)("resolve context with Rendi backend", () => {
  const storage = falStorage();
  const rendiBackend = canRun
    ? createRendiBackend({ storage })
    : (null as never);

  test(
    "await Speech() uses Rendi backend for duration probing",
    async () => {
      const audio = await withResolveContext(
        { backend: rendiBackend, storage },
        () =>
          Speech({
            voice: "adam",
            model: elevenlabs.speechModel("eleven_turbo_v2"),
            children: "Hello world, this is a test.",
          }),
      );

      // Should be a ResolvedElement with duration probed via Rendi
      expect(audio).toBeInstanceOf(ResolvedElement);
      expect(audio.type).toBe("speech");
      expect(audio.duration).toBeGreaterThan(0);
      expect(audio.duration).toBeLessThan(30); // sanity check
      expect(audio.file).toBeDefined();

      console.log(
        `[rendi test] Speech resolved: duration=${audio.duration}s, ` +
          `file mediaType=${audio.meta.file.mediaType}`,
      );
    },
    { timeout: 120_000 },
  );

  test(
    "duration from Rendi matches local ffprobe (within tolerance)",
    async () => {
      // Generate speech WITHOUT context (uses local ffprobe)
      const localAudio = await Speech({
        voice: "adam",
        model: elevenlabs.speechModel("eleven_turbo_v2"),
        children: "Testing duration accuracy across backends.",
      });

      // Generate same speech WITH Rendi context
      const rendiAudio = await withResolveContext(
        { backend: rendiBackend, storage },
        () =>
          Speech({
            voice: "adam",
            model: elevenlabs.speechModel("eleven_turbo_v2"),
            children: "Testing duration accuracy across backends.",
          }),
      );

      console.log(
        `[rendi test] Local duration: ${localAudio.duration}s, Rendi duration: ${rendiAudio.duration}s`,
      );

      // Durations should match within 0.5s tolerance
      // (same audio, different probing backends)
      expect(Math.abs(localAudio.duration - rendiAudio.duration)).toBeLessThan(
        0.5,
      );
    },
    { timeout: 180_000 },
  );

  test(
    "Rendi backend ffprobe works directly on generated audio",
    async () => {
      // Generate speech locally (no context)
      const audio = await Speech({
        voice: "rachel",
        model: elevenlabs.speechModel("eleven_turbo_v2"),
        children: "Quick test.",
      });

      // Use Rendi to probe the same file
      const path = await rendiBackend.resolvePath(audio.file);
      const info = await rendiBackend.ffprobe(path);

      console.log(
        `[rendi test] Direct ffprobe: duration=${info.duration}s, path=${path}`,
      );

      expect(info.duration).toBeGreaterThan(0);
      // Should be close to the locally-probed duration
      expect(Math.abs(info.duration - audio.duration)).toBeLessThan(0.5);
    },
    { timeout: 120_000 },
  );
});
