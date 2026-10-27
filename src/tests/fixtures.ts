/**
 * Shared test media fixtures.
 *
 * `media/` and `output/` are gitignored, so every test that referenced a
 * local path there could only pass on a machine that had previously run the
 * (paid) example scripts. On a fresh checkout — and in CI — those tests
 * failed with ENOENT. Fixtures now live in R2 behind `s3.varg.ai/test-media/`
 * and are downloaded once per machine into a temp directory.
 *
 * Mirrors the pattern already used by `text-measure.test.ts` for fonts.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

/** Public R2 mirror for test-only media. */
export const FIXTURE_BASE_URL = "https://s3.varg.ai/test-media";

/** Local cache directory — survives across runs, downloads once. */
export const FIXTURE_DIR = "/tmp/varg-test-fixtures";

/**
 * Fixtures that are present in R2 and safe to depend on.
 *
 * Anything NOT listed here is unavailable (see MISSING_FIXTURES) and its
 * tests are skipped rather than silently failing.
 */
export const FIXTURES = {
  "test-red.png": `${FIXTURE_BASE_URL}/test-red.png`,
  "test-green.png": `${FIXTURE_BASE_URL}/test-green.png`,
  "test-blue.png": `${FIXTURE_BASE_URL}/test-blue.png`,
  "replicate-forest.png": `${FIXTURE_BASE_URL}/replicate-forest.png`,
  "madi-portrait.png": `${FIXTURE_BASE_URL}/madi-portrait.png`,
  "sora-landscape.mp4": `${FIXTURE_BASE_URL}/sora-landscape.mp4`,
  "simpsons-scene.mp4": `${FIXTURE_BASE_URL}/simpsons-scene.mp4`,
  "workflow-talking-synced.mp4": `${FIXTURE_BASE_URL}/workflow-talking-synced.mp4`,
} as const;

export type FixtureName = keyof typeof FIXTURES;

/**
 * Fixtures the old tests referenced that exist NOWHERE — not in the repo
 * (gitignored) and 404 on R2: `cyberpunk-street.png`, `fal-coffee-shop.png`,
 * `kirill-voice.mp3`.
 *
 * None of the tests using them cared about the *content* — an image test
 * needs any image, an audio test needs any audio track. So instead of
 * skipping, they now use an existing R2 image or the locally synthesized
 * silent audio below. Nothing is left pending on a missing upload.
 */

/** Absolute local path a fixture will be downloaded to. */
export function fixturePath(name: FixtureName): string {
  return `${FIXTURE_DIR}/${name}`;
}

/** Path of the generated silent audio track. */
export const SILENT_AUDIO_PATH = `${FIXTURE_DIR}/silence-5s.mp3`;

/**
 * Synthesize a 5s silent MP3 via ffmpeg, cached on disk.
 *
 * Replaces the unavailable `media/kirill-voice.mp3`. Audio-layer tests assert
 * that a muxed output file is produced, never what it sounds like — so a
 * generated track is strictly better than a binary fixture: no download, no
 * upload to maintain, and deterministic.
 */
export async function ensureSilentAudio(): Promise<string> {
  if (!existsSync(FIXTURE_DIR)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  }
  if (existsSync(SILENT_AUDIO_PATH)) return SILENT_AUDIO_PATH;

  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=stereo",
      "-t",
      "5",
      "-c:a",
      "libmp3lame",
      "-q:a",
      "9",
      SILENT_AUDIO_PATH,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to generate silent audio fixture:\n${stderr}`);
  }
  return SILENT_AUDIO_PATH;
}

/** Path of the landscape still extracted from sora-landscape.mp4. */
export const LANDSCAPE_IMAGE_PATH = `${FIXTURE_DIR}/sora-landscape-frame.png`;

/**
 * Extract a landscape (16:9) still from the landscape video, cached on disk.
 *
 * Replaces the unavailable `media/cyberpunk-street.png`. The available R2
 * images are square (1024x1024) and portrait (1080x1920), so neither can
 * stand in for tests that specifically exercise landscape-into-portrait
 * fitting (e.g. "portrait 9:16 landscape image with zoompan cover mode") —
 * substituting one would quietly stop testing the aspect-ratio path.
 *
 * Scaled to 640x360: still 16:9, but zoompan cost scales with source pixels
 * and a full 1280x720 still pushed those tests past their 10s timeout.
 */
export async function ensureLandscapeImage(): Promise<string> {
  if (existsSync(LANDSCAPE_IMAGE_PATH)) return LANDSCAPE_IMAGE_PATH;

  const [videoPath] = await ensureFixtures("sora-landscape.mp4");

  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-i",
      videoPath as string,
      "-vframes",
      "1",
      "-vf",
      "scale=640:360",
      LANDSCAPE_IMAGE_PATH,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract landscape image fixture:\n${stderr}`);
  }
  return LANDSCAPE_IMAGE_PATH;
}

/**
 * Download the named fixtures if not already cached, returning their local
 * paths in the same order. Call from `beforeAll`.
 */
export async function ensureFixtures(
  ...names: FixtureName[]
): Promise<string[]> {
  if (!existsSync(FIXTURE_DIR)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  return Promise.all(
    names.map(async (name) => {
      const localPath = fixturePath(name);
      if (existsSync(localPath)) return localPath;

      const url = FIXTURES[name];
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Failed to download test fixture ${name} from ${url}: ${res.status}`,
        );
      }
      writeFileSync(localPath, new Uint8Array(await res.arrayBuffer()));
      return localPath;
    }),
  );
}
