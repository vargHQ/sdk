import { describe, expect, test } from "bun:test";
import { JOB_WAIT_EXIT, runJobsWait } from "../../cli/commands/jobs";
import {
  type VargJob,
  VargJobWaitError,
  type WaitForJobOptions,
  waitForJob,
} from "./varg-jobs";

const BASE = "https://api.test/v2";
const JOB_ID = "job_abc123";

type Reply =
  | {
      status?: number;
      body?: unknown;
      headers?: Record<string, string>;
      /** Simulated server hold time (advances the fake clock). */
      holdMs?: number;
    }
  | { throws: Error; holdMs?: number };

/**
 * Fake clock + scripted fetch. `sleep` advances the clock instantly and
 * records each delay, so backoff is asserted without real waiting.
 */
function harness(replies: Reply[] | ((call: number, url: string) => Reply)) {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const urls: string[] = [];
  const headers: Array<Record<string, string>> = [];
  const fetchMock = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const call = urls.length;
    urls.push(url);
    headers.push((init?.headers ?? {}) as Record<string, string>);
    const reply =
      typeof replies === "function"
        ? replies(call, url)
        : (replies[Math.min(call, replies.length - 1)] as Reply);
    t += reply.holdMs ?? 0;
    if ("throws" in reply) throw reply.throws;
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json", ...reply.headers },
    });
  }) as unknown as typeof fetch;
  const hooks: Pick<WaitForJobOptions, "fetch" | "sleep" | "now"> = {
    fetch: fetchMock,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    now: () => t,
  };
  return { hooks, sleeps, urls, headers, elapsed: () => t - 1_000_000 };
}

const job = (status: string, extra: Partial<VargJob> = {}): VargJob => ({
  id: JOB_ID,
  status,
  ...extra,
});

const completed = job("completed", {
  output: {
    version: "v1",
    outputs: [{ url: "https://s3.varg.ai/o/out.mp4", media_type: "video/mp4" }],
  },
});

const opts = (
  hooks: Pick<WaitForJobOptions, "fetch" | "sleep" | "now">,
  extra: Partial<WaitForJobOptions> = {},
) => ({
  baseUrl: BASE,
  apiKey: "varg_test",
  ...hooks,
  ...extra,
});

describe("waitForJob", () => {
  test("terminal on first call: one request, no sleeps", async () => {
    const h = harness([{ body: completed, headers: { "X-Varg-Wait": "120" } }]);
    const seen: string[] = [];
    const result = await waitForJob(
      JOB_ID,
      opts(h.hooks, { onStatus: (j) => seen.push(j.status) }),
    );
    expect(result.status).toBe("completed");
    expect(h.urls).toEqual([`${BASE}/jobs/${JOB_ID}?wait=50`]);
    expect(h.headers[0]?.Authorization).toBe("Bearer varg_test");
    expect(h.sleeps).toEqual([]);
    expect(seen).toEqual(["completed"]);
  });

  test("several long-poll rounds: re-polls immediately while the server holds", async () => {
    const held = {
      holdMs: 50_000,
      headers: { "X-Varg-Wait": "50000", "X-Varg-Wait-Timeout": "1" },
    };
    const h = harness([
      { body: job("running", { stage: "rendering" }), ...held },
      { body: job("running", { stage: "rendering" }), ...held },
      { body: job("running", { stage: "rendering", progress: 0.5 }), ...held },
      { body: completed, holdMs: 12_000, headers: { "X-Varg-Wait": "12000" } },
    ]);
    const seen: string[] = [];
    const result = await waitForJob(
      JOB_ID,
      opts(h.hooks, {
        onStatus: (j) => seen.push(`${j.status}:${j.progress ?? ""}`),
      }),
    );
    expect(result.status).toBe("completed");
    expect(h.urls.length).toBe(4);
    expect(h.urls.every((u) => u.endsWith("?wait=50"))).toBe(true);
    expect(h.sleeps).toEqual([]);
    // onStatus fires only on changes
    expect(seen).toEqual(["running:", "running:0.5", "completed:"]);
  });

  test("long-poll server returning early on a status change re-polls without sleeping", async () => {
    const h = harness([
      { body: job("queued"), headers: { "X-Varg-Wait": "300" }, holdMs: 300 },
      {
        body: job("running", { stage: "rendering" }),
        headers: { "X-Varg-Wait": "800" },
        holdMs: 800,
      },
      { body: completed, headers: { "X-Varg-Wait": "20000" }, holdMs: 20_000 },
    ]);
    const result = await waitForJob(JOB_ID, opts(h.hooks));
    expect(result.status).toBe("completed");
    expect(h.sleeps).toEqual([]);
  });

  test("old server ignoring wait: falls back to polling with 2s -> 10s backoff (no hot loop)", async () => {
    let calls = 0;
    const h = harness(() => {
      calls++;
      return calls < 12
        ? { body: job("running"), holdMs: 50 }
        : { body: completed, holdMs: 50 };
    });
    const result = await waitForJob(JOB_ID, opts(h.hooks));
    expect(result.status).toBe("completed");
    expect(h.urls.length).toBe(12);
    // one sleep between every pair of non-terminal answers
    expect(h.sleeps.length).toBe(11);
    expect(h.sleeps[0]).toBe(2_000);
    // non-decreasing
    expect([...h.sleeps].sort((a, b) => a - b)).toEqual(h.sleeps);
    expect(Math.max(...h.sleeps)).toBe(10_000);
    expect(h.sleeps.at(-1)).toBe(10_000);
  });

  test("overall timeout throws VargJobWaitError(timeout) with the last job", async () => {
    const h = harness((_, url) => {
      const wait = Number(new URL(url).searchParams.get("wait"));
      return {
        body: job("running", { stage: "rendering" }),
        holdMs: wait * 1000,
        headers: {
          "X-Varg-Wait": String(wait * 1000),
          "X-Varg-Wait-Timeout": "1",
        },
      };
    });
    const err = await waitForJob(
      JOB_ID,
      opts(h.hooks, { timeoutMs: 120_000 }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(VargJobWaitError);
    expect((err as VargJobWaitError).reason).toBe("timeout");
    expect((err as VargJobWaitError).job?.status).toBe("running");
    // 50 + 50 + 20 seconds: the last request only asks for what is left
    expect(h.urls.map((u) => new URL(u).searchParams.get("wait"))).toEqual([
      "50",
      "50",
      "20",
    ]);
    expect(h.elapsed()).toBe(120_000);
  });

  test("timeout also bounds the old-server fallback", async () => {
    const h = harness([{ body: job("queued"), holdMs: 10 }]);
    const err = await waitForJob(
      JOB_ID,
      opts(h.hooks, { timeoutMs: 30_000 }),
    ).catch((e) => e);
    expect((err as VargJobWaitError).reason).toBe("timeout");
    expect(h.elapsed()).toBeLessThanOrEqual(30_000 + 10);
    expect(h.urls.length).toBeLessThan(10);
  });

  test("404 fails fast with reason not_found", async () => {
    const h = harness([
      { status: 404, body: { error: { message: "job not found" } } },
    ]);
    const err = await waitForJob(JOB_ID, opts(h.hooks)).catch((e) => e);
    expect(err).toBeInstanceOf(VargJobWaitError);
    expect((err as VargJobWaitError).reason).toBe("not_found");
    expect((err as VargJobWaitError).statusCode).toBe(404);
    expect((err as VargJobWaitError).message).toBe("job not found");
    expect(h.urls.length).toBe(1);
    expect(h.sleeps).toEqual([]);
  });

  test("401 / 403 fail fast with reason auth", async () => {
    for (const status of [401, 403]) {
      const h = harness([{ status, body: { error: "bad key" } }]);
      const err = await waitForJob(JOB_ID, opts(h.hooks)).catch((e) => e);
      expect((err as VargJobWaitError).reason).toBe("auth");
      expect(h.urls.length).toBe(1);
    }
  });

  test("5xx and network errors are retried with backoff", async () => {
    const h = harness([
      { status: 502, body: { error: "bad gateway" } },
      { throws: new TypeError("fetch failed") },
      { status: 503, body: {} },
      { body: completed },
    ]);
    const result = await waitForJob(JOB_ID, opts(h.hooks));
    expect(result.status).toBe("completed");
    expect(h.urls.length).toBe(4);
    expect(h.sleeps).toEqual([1_000, 2_000, 4_000]);
  });

  test("persistent 5xx gives up after maxConsecutiveErrors", async () => {
    const h = harness([{ status: 500, body: { error: "boom" } }]);
    const err = await waitForJob(
      JOB_ID,
      opts(h.hooks, { maxConsecutiveErrors: 3 }),
    ).catch((e) => e);
    expect((err as VargJobWaitError).reason).toBe("http");
    expect((err as VargJobWaitError).statusCode).toBe(500);
    expect(h.urls.length).toBe(3);
  });

  test("429 honors Retry-After", async () => {
    const h = harness([
      { status: 429, body: {}, headers: { "Retry-After": "7" } },
      { body: completed },
    ]);
    await waitForJob(JOB_ID, opts(h.hooks));
    expect(h.sleeps).toEqual([7_000]);
  });

  test("failed and cancelled are returned, not thrown", async () => {
    for (const status of ["failed", "cancelled"]) {
      const h = harness([{ body: job(status, { error: "nope" }) }]);
      const result = await waitForJob(JOB_ID, opts(h.hooks));
      expect(result.status).toBe(status);
    }
  });

  test("awaiting_confirmation returns by default, keeps waiting when disabled", async () => {
    const paused = job("awaiting_confirmation");
    const h1 = harness([{ body: paused }]);
    expect((await waitForJob(JOB_ID, opts(h1.hooks))).status).toBe(
      "awaiting_confirmation",
    );

    const h2 = harness([{ body: paused, holdMs: 50_000 }, { body: completed }]);
    const r = await waitForJob(
      JOB_ID,
      opts(h2.hooks, { returnOnAwaitingConfirmation: false }),
    );
    expect(r.status).toBe("completed");
  });

  test("abort signal stops the wait", async () => {
    const ac = new AbortController();
    const h = harness(() => {
      ac.abort(new Error("stopped"));
      return { body: job("running"), holdMs: 10 };
    });
    const err = await waitForJob(
      JOB_ID,
      opts(h.hooks, { signal: ac.signal }),
    ).catch((e) => e);
    expect((err as Error).message).toBe("stopped");
  });
});

describe("vargai jobs wait (runJobsWait)", () => {
  function io(h: ReturnType<typeof harness>) {
    let out = "";
    let err = "";
    return {
      io: {
        stdout: (s: string) => {
          out += s;
        },
        stderr: (s: string) => {
          err += s;
        },
        wait: h.hooks,
      },
      out: () => out,
      err: () => err,
    };
  }
  const params = {
    jobId: JOB_ID,
    timeoutSec: 1800,
    json: false,
    quiet: false,
    apiKey: "varg_test",
    baseUrl: BASE,
  };

  test("completed → exit 0, summary + output URLs on stdout, transitions on stderr", async () => {
    const h = harness([
      { body: job("running", { stage: "rendering" }), holdMs: 50_000 },
      { body: completed },
    ]);
    const c = io(h);
    const code = await runJobsWait(params, c.io);
    expect(code).toBe(JOB_WAIT_EXIT.completed);
    expect(c.out()).toBe(`completed ${JOB_ID}\nhttps://s3.varg.ai/o/out.mp4\n`);
    expect(c.err()).toContain("running · rendering");
    expect(c.err()).toContain("completed");
  });

  test("--json prints the final job JSON", async () => {
    const h = harness([{ body: completed }]);
    const c = io(h);
    const code = await runJobsWait({ ...params, json: true }, c.io);
    expect(code).toBe(0);
    expect(JSON.parse(c.out())).toEqual(completed);
  });

  test("failed / cancelled → exit 1", async () => {
    for (const status of ["failed", "cancelled"]) {
      const c = io(
        harness([{ body: job(status, { error: "provider error" }) }]),
      );
      expect(await runJobsWait(params, c.io)).toBe(JOB_WAIT_EXIT.failed);
    }
  });

  test("timeout → exit 2", async () => {
    const h = harness((_, url) => {
      const wait = Number(new URL(url).searchParams.get("wait"));
      return {
        body: job("running"),
        holdMs: wait * 1000,
        headers: { "X-Varg-Wait-Timeout": "1" },
      };
    });
    const c = io(h);
    const code = await runJobsWait(
      { ...params, timeoutSec: 60, json: true },
      c.io,
    );
    expect(code).toBe(JOB_WAIT_EXIT.timeout);
    expect(JSON.parse(c.out()).status).toBe("running");
    expect(c.err()).toContain("timed out");
  });

  test("404 → exit 3", async () => {
    const c = io(
      harness([{ status: 404, body: { error: { message: "job not found" } } }]),
    );
    const code = await runJobsWait({ ...params, json: true }, c.io);
    expect(code).toBe(JOB_WAIT_EXIT.error);
    expect(JSON.parse(c.out()).error.reason).toBe("not_found");
  });

  test("missing API key → exit 3 without a request", async () => {
    const h = harness([{ body: completed }]);
    const c = io(h);
    expect(await runJobsWait({ ...params, apiKey: "" }, c.io)).toBe(
      JOB_WAIT_EXIT.error,
    );
    expect(h.urls.length).toBe(0);
  });

  test("awaiting_confirmation → exit 4", async () => {
    const c = io(harness([{ body: job("awaiting_confirmation") }]));
    expect(await runJobsWait(params, c.io)).toBe(
      JOB_WAIT_EXIT.awaitingConfirmation,
    );
    expect(c.err()).toContain("/confirm");
  });

  test("--quiet suppresses stderr status lines", async () => {
    const c = io(harness([{ body: completed }]));
    await runJobsWait({ ...params, quiet: true }, c.io);
    expect(c.err()).toBe("");
    expect(c.out()).toContain("completed");
  });
});
