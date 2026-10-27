/**
 * Krea provider tests — submit / poll / download wire shapes, body building,
 * failure + cancel paths, abort. No network: fetch is replaced by a queue
 * harness (same pattern as magnific.test.ts).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
  ImageModelV3CallOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";
import { KreaProvider } from "../../providers/krea";
import {
  buildKreaBody,
  createKrea,
  KreaAPIError,
  kreaFileToUrl,
  resolveKreaPath,
} from "./krea";

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

type Reply = { status?: number; json?: unknown; bytes?: Uint8Array };

function makeFetchHarness(responses: Reply[]) {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  const original = globalThis.fetch;
  // biome-ignore lint/suspicious/noExplicitAny: harness
  (globalThis as any).fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      body:
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : null,
    });
    const next = queue.shift() ?? { status: 200, json: {} };
    if (next.bytes) {
      // biome-ignore lint/suspicious/noExplicitAny: Uint8Array typing mismatch in lib.dom.d.ts
      return new Response(next.bytes as any, { status: next.status ?? 200 });
    }
    return new Response(JSON.stringify(next.json ?? {}), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    calls,
    restore: () => {
      // biome-ignore lint/suspicious/noExplicitAny: harness
      (globalThis as any).fetch = original;
    },
  };
}

function callOptions(
  overrides: Partial<ImageModelV3CallOptions> = {},
): ImageModelV3CallOptions {
  return {
    prompt: "a ceramic teapot",
    n: 1,
    size: undefined,
    aspectRatio: undefined,
    seed: undefined,
    files: undefined,
    mask: undefined,
    providerOptions: {},
    ...overrides,
  };
}

const OUT = "https://gen.krea.ai/images/out.png";

describe("resolveKreaPath", () => {
  test("aliases: krea (latest) and krea-3 → image/krea/krea-3", () => {
    expect(resolveKreaPath("krea")).toBe("image/krea/krea-3");
    expect(resolveKreaPath("krea-3")).toBe("image/krea/krea-3");
    expect(resolveKreaPath("krea/krea-3")).toBe("image/krea/krea-3");
  });

  test("raw /generate/ paths pass through; unknown bare ids throw", () => {
    expect(resolveKreaPath("image/krea/krea-2/large")).toBe(
      "image/krea/krea-2/large",
    );
    expect(resolveKreaPath("/generate/enhance/krea/enhance")).toBe(
      "enhance/krea/enhance",
    );
    expect(() => resolveKreaPath("nope")).toThrow();
  });
});

describe("buildKreaBody (krea-3)", () => {
  const path = "image/krea/krea-3";

  test("prompt + aspect ratio + seed; resolution defaults to 1k", () => {
    const warnings: SharedV3Warning[] = [];
    const body = buildKreaBody(
      path,
      callOptions({ aspectRatio: "16:9", seed: 7 }),
      warnings,
    );
    expect(body).toEqual({
      prompt: "a ceramic teapot",
      seed: 7,
      aspect_ratio: "16:9",
      resolution: "1k",
    });
    expect(warnings).toHaveLength(0);
  });

  test("size → width/height and no resolution", () => {
    const body = buildKreaBody(path, callOptions({ size: "1024x768" }), []);
    expect(body).toEqual({
      prompt: "a ceramic teapot",
      width: 1024,
      height: 768,
    });
  });

  test("providerOptions.krea overrides; apiKey is never sent", () => {
    const body = buildKreaBody(
      path,
      callOptions({
        providerOptions: {
          krea: { thinking_mode: "ultra", resolution: "2k", apiKey: "secret" },
        },
      }),
      [],
    );
    expect(body).toEqual({
      prompt: "a ceramic teapot",
      thinking_mode: "ultra",
      resolution: "2k",
    });
  });

  test("unsupported aspect ratio is dropped with a warning", () => {
    const warnings: SharedV3Warning[] = [];
    const body = buildKreaBody(
      path,
      callOptions({ aspectRatio: "7:3" }),
      warnings,
    );
    expect(body.aspect_ratio).toBeUndefined();
    expect(warnings[0]).toMatchObject({
      type: "unsupported",
      feature: "aspectRatio",
    });
  });

  test("files → image_urls (URLs as-is, bytes as data URIs), capped at 8", () => {
    const files = [
      { type: "url" as const, url: "https://x/a.png" },
      {
        type: "file" as const,
        mediaType: "image/jpeg",
        data: new Uint8Array([1, 2, 3]),
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        type: "url" as const,
        url: `https://x/${i}.png`,
      })),
    ];
    const warnings: SharedV3Warning[] = [];
    const body = buildKreaBody(path, callOptions({ files }), warnings);
    const urls = body.image_urls as string[];
    expect(urls).toHaveLength(8);
    expect(urls[0]).toBe("https://x/a.png");
    expect(urls[1]).toBe("data:image/jpeg;base64,AQID");
    expect(warnings.some((w) => w.type === "other")).toBe(true);
  });
});

describe("kreaFileToUrl", () => {
  test("keeps existing data URIs and wraps raw base64", () => {
    expect(
      kreaFileToUrl({
        type: "file",
        mediaType: "image/png",
        data: "data:image/png;base64,AA",
      }),
    ).toBe("data:image/png;base64,AA");
    expect(
      kreaFileToUrl({ type: "file", mediaType: "image/webp", data: "AA" }),
    ).toBe("data:image/webp;base64,AA");
  });
});

describe("createKrea → imageModel.doGenerate", () => {
  let savedKey: string | undefined;
  beforeEach(() => {
    savedKey = process.env.KREA_API_KEY;
    delete process.env.KREA_API_KEY;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.KREA_API_KEY;
    else process.env.KREA_API_KEY = savedKey;
  });

  test("submit (Bearer) → poll /jobs/{id} → download bytes", async () => {
    const { calls, restore } = makeFetchHarness([
      { json: { job_id: "job-1", status: "queued" } },
      {
        json: { job_id: "job-1", status: "completed", result: { urls: [OUT] } },
      },
      { bytes: new Uint8Array([9, 8, 7]) },
    ]);
    try {
      const out = await createKrea({ apiKey: "krea-key" })
        .imageModel("krea")
        .doGenerate(callOptions({ aspectRatio: "4:3" }));

      expect(out.images).toHaveLength(1);
      expect((out.images[0] as Uint8Array)[0]).toBe(9);
      expect(out.providerMetadata).toEqual({
        krea: { images: [{ jobId: "job-1", url: OUT }] },
      });

      expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
        "POST https://api.krea.ai/generate/image/krea/krea-3",
        "GET https://api.krea.ai/jobs/job-1",
        `GET ${OUT}`,
      ]);
      expect(calls[0]?.headers.authorization).toBe("Bearer krea-key");
      expect(calls[0]?.body).toEqual({
        prompt: "a ceramic teapot",
        aspect_ratio: "4:3",
        resolution: "1k",
      });
      expect(calls[1]?.headers.authorization).toBe("Bearer krea-key");
      expect(calls[2]?.headers.authorization).toBeUndefined();
    } finally {
      restore();
    }
  });

  test("per-call providerOptions.krea.apiKey wins and env is the fallback", async () => {
    process.env.KREA_API_KEY = "env-key";
    const { calls, restore } = makeFetchHarness([
      { json: { job_id: "j", status: "queued" } },
      { json: { job_id: "j", status: "completed", result: { urls: [OUT] } } },
      { bytes: new Uint8Array([1]) },
    ]);
    try {
      await createKrea()
        .imageModel("krea-3")
        .doGenerate(
          callOptions({ providerOptions: { krea: { apiKey: "call-key" } } }),
        );
      expect(calls[0]?.headers.authorization).toBe("Bearer call-key");
      expect(calls[0]?.body?.apiKey).toBeUndefined();
    } finally {
      restore();
    }
  });

  test("missing key throws before any request", async () => {
    const { calls, restore } = makeFetchHarness([]);
    try {
      await expect(
        createKrea().imageModel("krea").doGenerate(callOptions()),
      ).rejects.toBeInstanceOf(KreaAPIError);
      expect(calls).toHaveLength(0);
    } finally {
      restore();
    }
  });

  test("failed job surfaces error.message", async () => {
    const { restore } = makeFetchHarness([
      { json: { job_id: "j", status: "queued" } },
      {
        json: {
          job_id: "j",
          status: "failed",
          error: { code: "moderation", message: "Content rejected" },
        },
      },
    ]);
    try {
      await expect(
        createKrea({ apiKey: "k" })
          .imageModel("krea")
          .doGenerate(callOptions()),
      ).rejects.toThrow("krea job j failed: Content rejected");
    } finally {
      restore();
    }
  });

  test("submit HTTP error carries the status code", async () => {
    const { restore } = makeFetchHarness([
      { status: 429, json: { error: "max concurrent jobs" } },
    ]);
    try {
      const err = await Promise.resolve(
        createKrea({ apiKey: "k" })
          .imageModel("krea")
          .doGenerate(callOptions()),
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(KreaAPIError);
      expect((err as KreaAPIError).statusCode).toBe(429);
    } finally {
      restore();
    }
  });

  test("abort cancels the upstream job (DELETE /jobs/{id})", async () => {
    const { calls, restore } = makeFetchHarness([
      { json: { job_id: "job-a", status: "queued" } },
      { json: {} }, // DELETE
    ]);
    const controller = new AbortController();
    try {
      // abort right after submit: the poll loop sees the signal first.
      const origFetch = globalThis.fetch;
      // biome-ignore lint/suspicious/noExplicitAny: harness
      (globalThis as any).fetch = async (input: any, init?: RequestInit) => {
        const res = await origFetch(input, init);
        if ((init?.method ?? "GET") === "POST") controller.abort();
        return res;
      };
      await expect(
        createKrea({ apiKey: "k" })
          .imageModel("krea")
          .doGenerate(callOptions({ abortSignal: controller.signal })),
      ).rejects.toThrow("aborted");
      // biome-ignore lint/suspicious/noExplicitAny: harness
      (globalThis as any).fetch = origFetch;
      expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
        "POST https://api.krea.ai/generate/image/krea/krea-3",
        "DELETE https://api.krea.ai/jobs/job-a",
      ]);
    } finally {
      restore();
    }
  });

  test("non-image model types throw NoSuchModelError", () => {
    expect(() => createKrea().languageModel("x")).toThrow();
  });
});

describe("KreaProvider (CLI)", () => {
  test("submit → getStatus → cancel", async () => {
    const { calls, restore } = makeFetchHarness([
      { json: { job_id: "c-1", status: "queued" } },
      { json: { job_id: "c-1", status: "sampling" } },
      { json: { job_id: "c-1", status: "completed", result: { urls: [OUT] } } },
      { status: 404, json: { error: "gone" } },
    ]);
    try {
      const p = new KreaProvider({ apiKey: "cli-key" });
      const id = await p.submit("krea", { prompt: "x" });
      expect(id).toBe("c-1");
      expect(calls[0]?.url).toBe(
        "https://api.krea.ai/generate/image/krea/krea-3",
      );
      expect(calls[0]?.body).toEqual({ prompt: "x", resolution: "1k" });
      expect((await p.getStatus(id)).status).toBe("processing");
      expect(await p.getStatus(id)).toMatchObject({
        status: "completed",
        output: { urls: [OUT] },
      });
      await p.cancel(id); // 404 → already gone, no throw
      expect(calls[3]?.method).toBe("DELETE");
    } finally {
      restore();
    }
  });

  test("failed / cancelled map to terminal statuses with the error", async () => {
    const { restore } = makeFetchHarness([
      {
        json: {
          job_id: "c",
          status: "failed",
          error: { code: "x", message: "bad input" },
        },
      },
      { json: { job_id: "c", status: "cancelled" } },
    ]);
    try {
      const p = new KreaProvider({ apiKey: "k" });
      expect(await p.getStatus("c")).toMatchObject({
        status: "failed",
        error: "bad input",
      });
      expect(await p.getStatus("c")).toMatchObject({ status: "cancelled" });
    } finally {
      restore();
    }
  });
});
