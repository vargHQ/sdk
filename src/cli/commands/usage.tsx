/**
 * varg usage command
 * View daily usage and cost estimates
 */

import { defineCommand } from "citty";
import {
  type DailyLimits,
  type DailyUsageState,
  formatCost,
  getTimeUntilReset,
  getTodayDate,
  getUsageHistory,
  loadDailyUsage,
  loadLimitsFromEnv,
  type UsageJsonOutput,
} from "../../ai-sdk/usage";

function printUsage(state: DailyUsageState, limits: DailyLimits): void {
  const hasLimits =
    limits.images ||
    limits.videos ||
    limits.speechMinutes ||
    limits.musicMinutes ||
    limits.totalCost;
  const timeUntilReset = getTimeUntilReset(limits.resetHourUTC);

  console.log(`\nUsage for ${state.date}`);
  console.log("─".repeat(40));

  // Resources
  console.log(`  Images: ${state.images}`);
  console.log(`  Videos: ${state.videos} (${Math.round(state.videoSeconds)}s)`);
  if (state.speechMinutes > 0) {
    console.log(`  Speech: ${Math.round(state.speechMinutes * 10) / 10} min`);
  }
  if (state.musicMinutes > 0) {
    console.log(`  Music: ${Math.round(state.musicMinutes * 10) / 10} min`);
  }

  console.log(`\n  Total: ${formatCost(state.totalCost)}`);

  // Limits if configured
  if (hasLimits) {
    console.log("\nLimits:");
    if (limits.images) {
      const pct = Math.round((state.images / limits.images) * 100);
      console.log(`  Images: ${state.images}/${limits.images} (${pct}%)`);
    }
    if (limits.videos) {
      const pct = Math.round((state.videos / limits.videos) * 100);
      console.log(`  Videos: ${state.videos}/${limits.videos} (${pct}%)`);
    }
    if (limits.speechMinutes) {
      const pct = Math.round(
        (state.speechMinutes / limits.speechMinutes) * 100,
      );
      console.log(
        `  Speech: ${Math.round(state.speechMinutes)}/${limits.speechMinutes} min (${pct}%)`,
      );
    }
    if (limits.musicMinutes) {
      const pct = Math.round((state.musicMinutes / limits.musicMinutes) * 100);
      console.log(
        `  Music: ${Math.round(state.musicMinutes)}/${limits.musicMinutes} min (${pct}%)`,
      );
    }
    if (limits.totalCost) {
      const pct = Math.round((state.totalCost / limits.totalCost) * 100);
      console.log(
        `  Cost: ${formatCost(state.totalCost)}/${formatCost(limits.totalCost)} (${pct}%)`,
      );
    }
  }

  const resetHour = limits.resetHourUTC ?? 0;
  console.log(
    `\nResets in ${timeUntilReset.hours}h ${timeUntilReset.minutes}m (at ${resetHour}:00 UTC)\n`,
  );
}

function printHistory(history: DailyUsageState[]): void {
  console.log("\nUsage History (last 7 days)");
  console.log("─".repeat(50));

  if (history.length === 0) {
    console.log("  No usage history found\n");
    return;
  }

  console.log(
    `  ${"Date".padEnd(14)}${"Images".padStart(8)}${"Videos".padStart(8)}${"Cost".padStart(12)}`,
  );
  console.log("  " + "─".repeat(42));

  for (const day of history) {
    console.log(
      `  ${day.date.padEnd(14)}${String(day.images).padStart(8)}${String(day.videos).padStart(8)}${formatCost(day.totalCost).padStart(12)}`,
    );
  }
  console.log();
}

export function showUsageHelp(): void {
  console.log(`
varg usage - view daily usage and cost estimates

USAGE
  varg usage [options]

OPTIONS
  --json       Output as JSON
  --history    Show last 7 days
  --date       Show specific date (YYYY-MM-DD)

ENVIRONMENT VARIABLES
  VARG_DAILY_LIMIT_IMAGES          Max images per day
  VARG_DAILY_LIMIT_VIDEOS          Max videos per day
  VARG_DAILY_LIMIT_SPEECH_MINUTES  Max speech minutes
  VARG_DAILY_LIMIT_MUSIC_MINUTES   Max music minutes
  VARG_DAILY_LIMIT_COST            Max daily cost (USD)
  VARG_DAILY_RESET_HOUR_UTC        Hour to reset (0-23)

EXAMPLES
  # Show today's usage
  varg usage

  # Get JSON output
  varg usage --json

  # Show usage history
  varg usage --history
`);
}

function buildJsonOutput(
  state: DailyUsageState,
  limits: DailyLimits,
): UsageJsonOutput {
  const output: UsageJsonOutput = {
    date: state.date,
    counts: {
      image: state.images,
      video: state.videos,
      speech: Math.round(state.speechMinutes * 10) / 10,
      music: Math.round(state.musicMinutes * 10) / 10,
    },
    durations: {
      video: state.videoSeconds,
    },
    cost: {
      total: Math.round(state.totalCost * 1000) / 1000,
    },
    generations: state.generations,
  };

  // Add limits if configured
  const hasLimits =
    limits.images ||
    limits.videos ||
    limits.speechMinutes ||
    limits.musicMinutes ||
    limits.totalCost;

  if (hasLimits) {
    output.limits = {};
    if (limits.images) {
      output.limits.images = {
        current: state.images,
        limit: limits.images,
        percent: Math.round((state.images / limits.images) * 100),
      };
    }
    if (limits.videos) {
      output.limits.videos = {
        current: state.videos,
        limit: limits.videos,
        percent: Math.round((state.videos / limits.videos) * 100),
      };
    }
    if (limits.speechMinutes) {
      output.limits.speechMinutes = {
        current: state.speechMinutes,
        limit: limits.speechMinutes,
        percent: Math.round((state.speechMinutes / limits.speechMinutes) * 100),
      };
    }
    if (limits.musicMinutes) {
      output.limits.musicMinutes = {
        current: state.musicMinutes,
        limit: limits.musicMinutes,
        percent: Math.round((state.musicMinutes / limits.musicMinutes) * 100),
      };
    }
    if (limits.totalCost) {
      output.limits.cost = {
        current: state.totalCost,
        limit: limits.totalCost,
        percent: Math.round((state.totalCost / limits.totalCost) * 100),
      };
    }
  }

  return output;
}

export const usageCmd = defineCommand({
  meta: {
    name: "usage",
    description: "view daily usage and cost estimates",
  },
  args: {
    json: {
      type: "boolean",
      description: "output as json",
    },
    history: {
      type: "boolean",
      description: "show last 7 days",
    },
    date: {
      type: "string",
      description: "specific date (YYYY-MM-DD)",
    },
  },
  async run({ args, rawArgs }) {
    // Handle --help
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      showUsageHelp();
      return;
    }

    const limits = loadLimitsFromEnv();
    const date = (args.date as string) || getTodayDate(limits.resetHourUTC);

    if (args.history) {
      const history = await getUsageHistory(7);

      if (args.json) {
        console.log(JSON.stringify(history, null, 2));
        return;
      }

      printHistory(history);
      return;
    }

    const state = await loadDailyUsage(date);

    if (args.json) {
      const output = buildJsonOutput(state, limits);
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    printUsage(state, limits);
  },
});
