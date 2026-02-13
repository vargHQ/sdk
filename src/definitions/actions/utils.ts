/**
 * Shared utilities for action definitions
 * Replaces old provider helpers with direct client calls
 */

import { fal } from "@fal-ai/client";

const falApiKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
if (falApiKey) {
  fal.config({ credentials: falApiKey });
}

/**
 * Ensure a path or URL is a remote URL.
 * If it's a local file path, uploads to fal storage first.
 */
export async function ensureUrl(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  const file = Bun.file(pathOrUrl);
  if (!(await file.exists())) {
    throw new Error(`Local file not found: ${pathOrUrl}`);
  }

  const buffer = await file.arrayBuffer();
  return fal.storage.upload(new Blob([buffer]));
}

/**
 * Standard fal queue update logger
 */
export function logQueueUpdate(prefix: string) {
  return (update: { status: string; logs?: Array<{ message: string }> }) => {
    if (update.status === "IN_PROGRESS") {
      console.log(
        `[${prefix}] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
      );
    }
  };
}
