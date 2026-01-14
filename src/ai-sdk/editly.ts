import { $ } from "bun";

/**
 * Bun-compatible wrapper for editly.
 * Spawns editly via node subprocess since bun can't load native gl module.
 *
 * @see https://github.com/oven-sh/bun/issues/18779
 */

// Simplified types for bun wrapper (independent from main codebase)
export interface EditlyClip {
  layers: EditlyLayer[];
  duration?: number;
  transition?: {
    name?: string;
    duration?: number;
  } | null;
}

export interface EditlyLayer {
  type: string;
  text?: string;
  path?: string;
  [key: string]: unknown;
}

export interface EditlyConfig {
  outPath: string;
  clips: EditlyClip[];
  width?: number;
  height?: number;
  fps?: number;
  fast?: boolean;
  audioFilePath?: string;
  allowRemoteRequests?: boolean;
  [key: string]: unknown;
}

export async function editly(config: EditlyConfig): Promise<void> {
  const specJson = JSON.stringify(config);
  const tempFile = `/tmp/editly-spec-${Date.now()}.json`;

  await Bun.write(tempFile, specJson);

  try {
    await $`npx editly --json ${tempFile}`;
  } finally {
    await $`rm -f ${tempFile}`.quiet();
  }
}

export default editly;
