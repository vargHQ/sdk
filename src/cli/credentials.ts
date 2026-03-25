/**
 * Global credential management for vargai CLI.
 *
 * Stores and retrieves the user's API key from ~/.varg/credentials.
 * File is created with 0600 permissions (owner read/write only).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface VargCredentials {
  api_key: string;
  email: string;
  created_at: string;
}

const CREDENTIALS_DIR = join(homedir(), ".varg");
const CREDENTIALS_PATH = join(CREDENTIALS_DIR, "credentials");

// Module-level cache to avoid repeated file reads
let _cached: VargCredentials | null | undefined;

/**
 * Get the full credentials object from ~/.varg/credentials.
 * Returns null if the file doesn't exist or is malformed.
 * Result is cached in memory after first read.
 */
export function getCredentials(): VargCredentials | null {
  if (_cached !== undefined) return _cached;

  try {
    if (!existsSync(CREDENTIALS_PATH)) {
      _cached = null;
      return null;
    }

    const raw = readFileSync(CREDENTIALS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<VargCredentials>;

    if (!parsed.api_key || typeof parsed.api_key !== "string") {
      _cached = null;
      return null;
    }

    _cached = {
      api_key: parsed.api_key,
      email: parsed.email ?? "",
      created_at: parsed.created_at ?? new Date().toISOString(),
    };

    return _cached;
  } catch {
    _cached = null;
    return null;
  }
}

/**
 * Get the global API key from ~/.varg/credentials.
 * Returns null if not logged in.
 */
export function getGlobalApiKey(): string | null {
  const creds = getCredentials();
  return creds?.api_key ?? null;
}

/**
 * Save credentials to ~/.varg/credentials.
 * Creates the ~/.varg/ directory if it doesn't exist.
 * File is written with 0600 permissions (owner read/write only).
 */
export function saveCredentials(creds: VargCredentials): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2) + "\n", {
    mode: 0o600,
  });

  // Invalidate cache
  _cached = creds;
}

/**
 * Delete ~/.varg/credentials and clear cache.
 * Returns true if the file was deleted, false if it didn't exist.
 */
export function clearCredentials(): boolean {
  _cached = null;

  if (!existsSync(CREDENTIALS_PATH)) {
    return false;
  }

  unlinkSync(CREDENTIALS_PATH);
  return true;
}

/**
 * Get the path to the credentials file (for display purposes).
 */
export function getCredentialsPath(): string {
  return CREDENTIALS_PATH;
}
