/**
 * vargai topup — add credits to your account
 *
 * Opens the app billing page in the browser where the user can purchase credits.
 * If the user isn't logged in yet, directs them to `vargai login` first.
 */

import { defineCommand } from "citty";
import { getCredentials } from "../credentials";

const APP_URL = process.env.VARG_APP_URL ?? "https://app.varg.ai";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      Bun.spawn(["open", url]);
    } else if (platform === "linux") {
      Bun.spawn(["xdg-open", url]);
    } else if (platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", url]);
    }
  } catch {
    // silently fail — URL is printed below
  }
}

export const topupCmd = defineCommand({
  meta: {
    name: "topup",
    description: "add credits to your account",
  },
  async run() {
    const creds = getCredentials();

    if (!creds) {
      console.log();
      console.log(
        `${COLORS.yellow} !${COLORS.reset}  Not logged in. Run ${COLORS.cyan}vargai login${COLORS.reset} first.`,
      );
      console.log();
      return;
    }

    console.log();
    console.log(
      `${COLORS.bold}${COLORS.cyan}varg${COLORS.reset}${COLORS.dim} — add credits${COLORS.reset}`,
    );
    console.log();
    console.log(
      `${COLORS.dim}  Logged in as ${COLORS.reset}${COLORS.bold}${creds.email}${COLORS.reset}`,
    );
    console.log();

    const billingUrl = `${APP_URL}/dashboard?tab=billing`;

    console.log(
      `${COLORS.green} ✓${COLORS.reset}  Opening billing page in your browser...`,
    );
    console.log();

    await openBrowser(billingUrl);

    console.log(
      `${COLORS.dim}  If the browser didn't open, visit:${COLORS.reset}`,
    );
    console.log(`  ${COLORS.cyan}${billingUrl}${COLORS.reset}`);
    console.log();
    console.log(
      `${COLORS.dim}  Log in with ${COLORS.reset}${creds.email}${COLORS.dim} to manage credits.${COLORS.reset}`,
    );
    console.log();
  },
});
