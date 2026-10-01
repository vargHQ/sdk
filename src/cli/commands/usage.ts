/**
 * vargai usage — what you spent, and on what
 *
 * Reads /v2/analytics (summary + breakdown) with the saved API key. The
 * numbers are the API's — the same ones the dashboard and the MCP tools show.
 * Amounts are credits (1 credit = 1 unit of the API's `_cents` fields) and
 * are printed as credits only.
 *
 *   vargai usage                       last 30 days, by model
 *   vargai usage --by tool             by kind of work (video, image, …)
 *   vargai usage --by creator          by who made it (personal API key or person)
 *   vargai usage --from 2026-09-01     from a date (to now)
 *   vargai usage --json                the raw API responses
 */

import { defineCommand } from "citty";
import { getGlobalApiKey } from "../credentials";

const API_URL =
  process.env.VARG_API_URL ??
  process.env.VARG_GATEWAY_URL ??
  "https://api.varg.ai";

const DIMENSIONS = [
  "model",
  "tool",
  "workspace",
  "api_key",
  "member",
  "creator",
  "source",
  "status",
] as const;

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

type Envelope<T> = {
  data: T;
  meta: { from: string; to: string; timezone: string };
};

type Summary = {
  spend_cents: number;
  runs: number;
  jobs: number;
  unsuccessful_spend_cents: number;
  previous: { spend_cents: number } | null;
  change: { spend_cents: number; spend_pct: number | null } | null;
  balance: { available_cents: number } | null;
};

type Breakdown = {
  rows: {
    labels: Record<string, string>;
    spend_cents: number;
    share: number;
    runs: number;
  }[];
  other: { groups: number; spend_cents: number; share: number } | null;
  total: { spend_cents: number };
};

const credits = (cents: number) => cents.toLocaleString("en-US");
const day = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

async function get<T>(
  path: string,
  params: URLSearchParams,
  apiKey: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    throw new Error(body.error?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const usageCmd = defineCommand({
  meta: {
    name: "usage",
    description: "show what you spent, and on what",
  },
  args: {
    from: {
      type: "string",
      description: "start date (YYYY-MM-DD), default: 30 days ago",
    },
    to: {
      type: "string",
      description: "end, exclusive (YYYY-MM-DD), default: now",
    },
    by: {
      type: "string",
      description: `group by: ${DIMENSIONS.join(" | ")}`,
      default: "model",
    },
    tz: {
      type: "string",
      description: "IANA timezone, default: this machine's",
    },
    limit: { type: "string", description: "rows to show", default: "10" },
    json: { type: "boolean", description: "print the raw API responses" },
  },
  async run({ args }) {
    const apiKey = process.env.VARG_API_KEY ?? getGlobalApiKey();
    if (!apiKey) {
      console.log(
        `\n${COLORS.yellow} !${COLORS.reset}  Not logged in. Run ${COLORS.cyan}vargai login${COLORS.reset} first.\n`,
      );
      return;
    }
    const by = (args.by ?? "model") as (typeof DIMENSIONS)[number];
    if (!DIMENSIONS.includes(by)) {
      console.log(
        `\n${COLORS.red} ✗${COLORS.reset}  --by must be one of: ${DIMENSIONS.join(", ")}\n`,
      );
      return;
    }

    const tz =
      args.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    const base = new URLSearchParams({ timezone: tz });
    if (args.from) base.set("from", args.from);
    if (args.to) base.set("to", args.to);
    const breakdownParams = new URLSearchParams(base);
    breakdownParams.set("group_by", by);
    breakdownParams.set(
      "limit",
      String(Math.min(Math.max(Number(args.limit) || 10, 1), 200)),
    );

    try {
      const [summary, breakdown] = await Promise.all([
        get<Envelope<Summary>>("/v2/analytics/summary", base, apiKey),
        get<Envelope<Breakdown>>(
          "/v2/analytics/breakdown",
          breakdownParams,
          apiKey,
        ),
      ]);

      if (args.json) {
        console.log(JSON.stringify({ summary, breakdown }, null, 2));
        return;
      }

      const s = summary.data;
      const { from, to, timezone } = summary.meta;
      const toInclusive = new Date(Date.parse(to) - 1).toISOString();
      console.log(
        `\n${COLORS.bold}${COLORS.cyan}varg${COLORS.reset}${COLORS.dim} — spend ${day(from, timezone)} – ${day(toInclusive, timezone)} (${timezone})${COLORS.reset}\n`,
      );
      const change =
        s.change &&
        s.previous &&
        s.previous.spend_cents > 0 &&
        s.change.spend_pct !== null
          ? `  ${COLORS.dim}${s.change.spend_pct >= 0 ? "▲" : "▼"} ${Math.abs(s.change.spend_pct)}% vs previous period${COLORS.reset}`
          : "";
      console.log(
        `  ${COLORS.bold}${credits(s.spend_cents)} credits${COLORS.reset}${change}`,
      );
      console.log(
        `  ${COLORS.dim}${credits(s.runs)} runs · ${credits(s.jobs)} jobs charged · ${credits(s.unsuccessful_spend_cents)} on failed or cancelled jobs${COLORS.reset}`,
      );
      if (s.balance) {
        console.log(
          `  ${COLORS.dim}Balance now:${COLORS.reset} ${credits(s.balance.available_cents)} credits available`,
        );
      }
      console.log();

      const rows = breakdown.data.rows;
      if (rows.length === 0) {
        console.log(
          `  ${COLORS.dim}Nothing charged in this range.${COLORS.reset}\n`,
        );
        return;
      }
      const labelWidth = Math.min(
        34,
        Math.max(...rows.map((r) => (r.labels[by] ?? "").length), 6),
      );
      const max = rows[0]?.spend_cents || 1;
      console.log(`  ${COLORS.dim}by ${by}${COLORS.reset}`);
      for (const r of rows) {
        const label = (r.labels[by] ?? "")
          .slice(0, labelWidth)
          .padEnd(labelWidth);
        const bar = "█".repeat(
          Math.max(1, Math.round((r.spend_cents / max) * 20)),
        );
        const pct = `${Math.round(r.share * 100)}%`.padStart(4);
        console.log(
          `  ${label}  ${credits(r.spend_cents).padStart(9)}  ${pct}  ${COLORS.dim}${bar}${COLORS.reset}`,
        );
      }
      const other = breakdown.data.other;
      if (other) {
        console.log(
          `  ${COLORS.dim}${`+ ${other.groups} more`.padEnd(labelWidth)}  ${credits(other.spend_cents).padStart(9)}  ${`${Math.round(other.share * 100)}%`.padStart(4)}${COLORS.reset}`,
        );
      }
      console.log();
    } catch (error) {
      console.log(
        `${COLORS.red} ✗${COLORS.reset}  ${error instanceof Error ? error.message : "Failed to fetch usage"}\n`,
      );
    }
  },
});
