/**
 * vargai jobs wait <job_id> — block until a varg API job finishes.
 *
 * Replaces `sleep N && curl …/v2/jobs/<id>` loops: one call that returns when
 * the job is done. Status transitions go to stderr; the result goes to stdout
 * (full job JSON with --json, otherwise the status line plus output URLs).
 *
 * Exit codes: 0 completed, 1 failed/cancelled, 2 timed out,
 * 3 auth / not found / other error, 4 paused in awaiting_confirmation.
 */

import { defineCommand } from "citty";
import { resolveVargConfig } from "../../ai-sdk/providers/varg";
import {
  isTerminalJobStatus,
  type VargJob,
  VargJobWaitError,
  type WaitForJobOptions,
  waitForJob,
} from "../../ai-sdk/providers/varg-jobs";
import { rawLog } from "../quiet";

export const JOB_WAIT_EXIT = {
  completed: 0,
  failed: 1,
  timeout: 2,
  error: 3,
  awaitingConfirmation: 4,
} as const;

export const DEFAULT_JOB_WAIT_TIMEOUT_SEC = 1800;

export interface JobsWaitParams {
  jobId: string;
  timeoutSec: number;
  json: boolean;
  quiet: boolean;
  apiKey: string;
  baseUrl: string;
}

export interface JobsWaitIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  /** Test hooks forwarded to waitForJob. */
  wait?: Pick<WaitForJobOptions, "fetch" | "sleep" | "now">;
}

function outputUrls(job: VargJob): string[] {
  return (job.output?.outputs ?? [])
    .map((o) => o.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

function describe(job: VargJob): string {
  const parts = [job.status];
  if (job.stage && job.stage !== job.status) parts.push(job.stage);
  if (typeof job.progress === "number") {
    parts.push(`${Math.round(job.progress * 100)}%`);
  }
  if (job.progress_message) parts.push(job.progress_message);
  return parts.join(" · ");
}

/** Run the wait and return the process exit code. */
export async function runJobsWait(
  params: JobsWaitParams,
  io: JobsWaitIO,
): Promise<number> {
  const { jobId, json, quiet } = params;
  const startedAt = Date.now();
  const elapsed = () => `${Math.round((Date.now() - startedAt) / 1000)}s`;
  const log = (line: string) => {
    if (!quiet) io.stderr(`[varg] ${line}\n`);
  };
  const printJob = (job: VargJob) =>
    io.stdout(`${JSON.stringify(job, null, 2)}\n`);

  if (!params.apiKey) {
    io.stderr("[varg] no API key: set VARG_API_KEY or run `vargai login`\n");
    if (json) {
      io.stdout(
        `${JSON.stringify({ error: { reason: "auth", message: "no API key" } })}\n`,
      );
    }
    return JOB_WAIT_EXIT.error;
  }

  let job: VargJob;
  try {
    job = await waitForJob(jobId, {
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      timeoutMs: params.timeoutSec * 1000,
      // Terminal states are logged once below, with the outcome.
      onStatus: (j) => {
        if (!isTerminalJobStatus(j.status)) {
          log(`${jobId} ${describe(j)} (+${elapsed()})`);
        }
      },
      ...io.wait,
    });
  } catch (err) {
    if (err instanceof VargJobWaitError) {
      if (err.reason === "timeout") {
        log(
          `${jobId} still ${err.job?.status ?? "unknown"} after ${params.timeoutSec}s — timed out`,
        );
        if (json && err.job) printJob(err.job);
        else if (!json)
          io.stdout(
            `${`timeout ${jobId} ${err.job?.status ?? ""}`.trimEnd()}\n`,
          );
        return JOB_WAIT_EXIT.timeout;
      }
      io.stderr(
        `[varg] ${err.message}${err.statusCode ? ` (HTTP ${err.statusCode})` : ""}\n`,
      );
      if (json) {
        io.stdout(
          `${JSON.stringify({ error: { reason: err.reason, status: err.statusCode ?? null, message: err.message } })}\n`,
        );
      }
      return JOB_WAIT_EXIT.error;
    }
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr(`[varg] ${msg}\n`);
    if (json) {
      io.stdout(
        `${JSON.stringify({ error: { reason: "other", message: msg } })}\n`,
      );
    }
    return JOB_WAIT_EXIT.error;
  }

  if (json) {
    printJob(job);
  } else {
    io.stdout(`${job.status} ${job.id}\n`);
    for (const url of outputUrls(job)) io.stdout(`${url}\n`);
  }

  switch (job.status) {
    case "completed":
      log(`${jobId} completed in ${elapsed()}`);
      return JOB_WAIT_EXIT.completed;
    case "awaiting_confirmation":
      log(
        `${jobId} is awaiting confirmation — POST ${params.baseUrl}/jobs/${jobId}/confirm`,
      );
      return JOB_WAIT_EXIT.awaitingConfirmation;
    default:
      log(
        `${jobId} ${job.status} after ${elapsed()}${job.error ? `: ${job.error}` : ""}`,
      );
      return JOB_WAIT_EXIT.failed;
  }
}

const jobsWaitCmd = defineCommand({
  meta: {
    name: "wait",
    description:
      "block until a job finishes (exit 0 completed, 1 failed/cancelled, 2 timeout, 3 error, 4 awaiting confirmation)",
  },
  args: {
    jobId: {
      type: "positional",
      description: "job id (job_…)",
      required: true,
    },
    timeout: {
      type: "string",
      description: `give up after this many seconds (default ${DEFAULT_JOB_WAIT_TIMEOUT_SEC})`,
      default: String(DEFAULT_JOB_WAIT_TIMEOUT_SEC),
    },
    json: {
      type: "boolean",
      description: "print the final job JSON to stdout",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "no status lines on stderr",
      default: false,
    },
    "base-url": {
      type: "string",
      description: "varg API base URL (default https://api.varg.ai/v2)",
    },
  },
  async run({ args }) {
    const timeoutSec = Number(args.timeout);
    if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
      process.stderr.write(
        `[varg] --timeout must be a positive number of seconds, got "${args.timeout}"\n`,
      );
      process.exitCode = JOB_WAIT_EXIT.error;
      return;
    }
    const config = resolveVargConfig(
      args["base-url"] ? { baseUrl: args["base-url"] } : {},
    );
    process.exitCode = await runJobsWait(
      {
        jobId: String(args.jobId).trim(),
        timeoutSec,
        json: Boolean(args.json),
        quiet: Boolean(args.quiet),
        apiKey: config.apiKey,
        baseUrl: config.baseUrl.replace(/\/+$/, ""),
      },
      {
        // rawLog bypasses the global --json/--quiet stdout filter (quiet.ts),
        // which would otherwise swallow the plain-text summary and URLs.
        stdout: (s) => rawLog(s.replace(/\n$/, "")),
        stderr: (s) => process.stderr.write(s),
      },
    );
  },
});

export const jobsCmd = defineCommand({
  meta: {
    name: "jobs",
    description: "work with varg API jobs",
  },
  subCommands: {
    wait: jobsWaitCmd,
  },
});
