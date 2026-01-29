/**
 * Storage layer for usage tracking
 * Persists daily usage data to .cache/usage/YYYY-MM-DD.json
 */

import type { DailyUsageState } from "./types";

const DEFAULT_USAGE_DIR = ".cache/usage";

/**
 * Get the date string for today, accounting for reset hour
 * @param resetHourUTC - Hour (0-23) when the day resets (default: 0 = midnight)
 */
export function getTodayDate(resetHourUTC = 0): string {
  const now = new Date();
  // Adjust for reset hour by subtracting the reset hour offset
  const adjusted = new Date(now.getTime() - resetHourUTC * 60 * 60 * 1000);
  return adjusted.toISOString().split("T")[0]!;
}

/**
 * Get time until next reset
 * @param resetHourUTC - Hour (0-23) when the day resets
 * @returns Object with hours and minutes until reset
 */
export function getTimeUntilReset(resetHourUTC = 0): {
  hours: number;
  minutes: number;
} {
  const now = new Date();
  const nowUTC = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000);

  // Calculate next reset time
  let resetTime = new Date(nowUTC);
  resetTime.setUTCHours(resetHourUTC, 0, 0, 0);

  // If we've passed today's reset, move to tomorrow
  if (nowUTC >= resetTime) {
    resetTime = new Date(resetTime.getTime() + 24 * 60 * 60 * 1000);
  }

  const diff = resetTime.getTime() - nowUTC.getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  return { hours, minutes };
}

/**
 * Get the file path for a given date's usage data
 */
function getUsagePath(date: string, usageDir = DEFAULT_USAGE_DIR): string {
  return `${usageDir}/${date}.json`;
}

/**
 * Create empty daily usage state
 */
export function createEmptyState(date: string): DailyUsageState {
  return {
    date,
    images: 0,
    videos: 0,
    videoSeconds: 0,
    speechMinutes: 0,
    musicMinutes: 0,
    totalCost: 0,
    generations: [],
  };
}

/**
 * Ensure the usage directory exists
 */
async function ensureUsageDir(usageDir = DEFAULT_USAGE_DIR): Promise<void> {
  const dir = Bun.file(usageDir);
  if (!(await dir.exists())) {
    // Create directory by writing a .gitkeep file
    await Bun.write(`${usageDir}/.gitkeep`, "");
  }
}

/**
 * Load daily usage state from disk
 * @param date - Date string in YYYY-MM-DD format
 * @param usageDir - Directory to store usage files
 */
export async function loadDailyUsage(
  date: string,
  usageDir = DEFAULT_USAGE_DIR,
): Promise<DailyUsageState> {
  const path = getUsagePath(date, usageDir);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return createEmptyState(date);
  }

  try {
    const content = await file.text();
    const state = JSON.parse(content) as DailyUsageState;

    // Ensure all fields exist (for backwards compatibility)
    return {
      date: state.date,
      images: state.images ?? 0,
      videos: state.videos ?? 0,
      videoSeconds: state.videoSeconds ?? 0,
      speechMinutes: state.speechMinutes ?? 0,
      musicMinutes: state.musicMinutes ?? 0,
      totalCost: state.totalCost ?? 0,
      generations: state.generations ?? [],
    };
  } catch {
    // If file is corrupted, start fresh
    return createEmptyState(date);
  }
}

/**
 * Save daily usage state to disk
 */
export async function saveDailyUsage(
  state: DailyUsageState,
  usageDir = DEFAULT_USAGE_DIR,
): Promise<void> {
  await ensureUsageDir(usageDir);
  const path = getUsagePath(state.date, usageDir);
  await Bun.write(path, JSON.stringify(state, null, 2));
}

/**
 * List all available usage dates (sorted newest first)
 */
export async function listUsageDates(
  usageDir = DEFAULT_USAGE_DIR,
): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");

  try {
    const files = await readdir(usageDir);
    return files
      .filter((f) => f.endsWith(".json") && f !== ".gitkeep")
      .map((f) => f.replace(".json", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Get usage for multiple days (for history view)
 */
export async function getUsageHistory(
  days = 7,
  usageDir = DEFAULT_USAGE_DIR,
): Promise<DailyUsageState[]> {
  const dates = await listUsageDates(usageDir);
  const history: DailyUsageState[] = [];

  for (const date of dates.slice(0, days)) {
    const state = await loadDailyUsage(date, usageDir);
    history.push(state);
  }

  return history;
}
