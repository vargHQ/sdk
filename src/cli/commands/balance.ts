/**
 * vargai balance — check your credit balance
 *
 * Fetches the current balance from the Gateway API using the saved API key.
 */

import { defineCommand } from "citty";
import { getCredentials, getGlobalApiKey } from "../credentials";

const GATEWAY_URL = process.env.VARG_GATEWAY_URL ?? "https://api.varg.ai";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export const balanceCmd = defineCommand({
  meta: {
    name: "balance",
    description: "check your credit balance",
  },
  async run() {
    const apiKey = process.env.VARG_API_KEY ?? getGlobalApiKey();
    const creds = getCredentials();

    if (!apiKey) {
      console.log();
      console.log(
        `${COLORS.yellow} !${COLORS.reset}  Not logged in. Run ${COLORS.cyan}vargai login${COLORS.reset} first.`,
      );
      console.log();
      return;
    }

    process.stdout.write(
      `\n${COLORS.dim}  ● Fetching balance...${COLORS.reset}`,
    );

    try {
      const res = await fetch(`${GATEWAY_URL}/v1/balance`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        process.stdout.write("\r\x1b[K");
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        console.log(
          `${COLORS.red} ✗${COLORS.reset}  ${err.error ?? `Failed to fetch balance (${res.status})`}`,
        );
        console.log();
        return;
      }

      const data = (await res.json()) as { balance_cents: number };

      process.stdout.write("\r\x1b[K");

      console.log(
        `${COLORS.bold}${COLORS.cyan}varg${COLORS.reset}${COLORS.dim} — account balance${COLORS.reset}`,
      );
      console.log();

      if (creds?.email) {
        console.log(`  ${COLORS.dim}Account:${COLORS.reset}  ${creds.email}`);
      }

      console.log(
        `  ${COLORS.dim}Balance:${COLORS.reset}  ${COLORS.bold}${data.balance_cents.toLocaleString()} credits${COLORS.reset} (${formatCents(data.balance_cents)})`,
      );
      console.log();

      if (data.balance_cents <= 0) {
        console.log(
          `  ${COLORS.yellow}No credits remaining.${COLORS.reset} Run ${COLORS.cyan}vargai topup${COLORS.reset} to add more.`,
        );
        console.log();
      }
    } catch (error) {
      process.stdout.write("\r\x1b[K");
      console.log(
        `${COLORS.red} ✗${COLORS.reset}  Failed to connect to gateway. Check your connection.`,
      );
      console.log();
    }
  },
});
