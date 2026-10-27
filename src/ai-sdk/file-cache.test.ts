/**
 * `fileCache` durability.
 *
 * These entries are paid AI generations — a cached image costs ~$0.15 to
 * recreate, a cached video ~$0.15 per second. The cache is the user's asset,
 * so the read path must never be able to destroy it.
 *
 * Regression: `get()` used to truncate expired entries with
 * `Bun.write(path, "")`, so merely *reading* a stale cache wiped it (13 GB of
 * generations across 329 files, in the case that surfaced this).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileCache } from "./file-cache";
import { withCache } from "./cache";

let dir: string;

beforeEach(async () => {
  // A temp dir, never the project's real .cache/ai — these tests write and
  // expire entries, and the real cache holds production data.
  dir = await mkdtemp(join(tmpdir(), "varg-file-cache-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Write an entry whose TTL has already elapsed. */
async function writeExpired(key: string, value: unknown) {
  const cache = fileCache({ dir });
  await cache.set(key, value, 1);
  await new Promise((r) => setTimeout(r, 5));
}

async function fileFor(key: string): Promise<string> {
  const entries = await readdir(dir);
  const match = entries.find((f) => f.includes(key) && f.endsWith(".json"));
  if (!match) throw new Error(`no cache file for ${key} in ${entries}`);
  return join(dir, match);
}

describe("fileCache", () => {
  test("round-trips a value", async () => {
    const cache = fileCache({ dir });
    await cache.set("k", { images: [1, 2, 3] });
    expect(await cache.get("k")).toEqual({ images: [1, 2, 3] });
  });

  test("round-trips binary data", async () => {
    const cache = fileCache({ dir });
    const bytes = new Uint8Array([0, 1, 250, 255]);
    await cache.set("bin", { data: bytes });
    const got = (await cache.get("bin")) as { data: Uint8Array };
    expect(got.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(got.data)).toEqual([0, 1, 250, 255]);
  });

  test("set() without a ttl stores an entry that never expires", async () => {
    const cache = fileCache({ dir });
    await cache.set("forever", { v: 1 });
    const raw = await Bun.file(await fileFor("forever")).json();
    expect(raw.expires).toBe(0);
  });

  test("reports a miss once the ttl has elapsed", async () => {
    await writeExpired("stale", { v: 1 });
    expect(await fileCache({ dir }).get("stale")).toBeUndefined();
  });

  test("reading an expired entry does NOT destroy the file", async () => {
    await writeExpired("precious", { v: "expensive to regenerate" });
    const path = await fileFor("precious");
    const before = (await stat(path)).size;
    expect(before).toBeGreaterThan(0);

    await fileCache({ dir }).get("precious");

    // The regression truncated to 0 bytes here, losing the payload while
    // leaving the file behind.
    expect((await stat(path)).size).toBe(before);
    expect((await Bun.file(path).json()).value).toEqual({
      v: "expensive to regenerate",
    });
  });

  test("repeated reads of an expired entry stay non-destructive", async () => {
    await writeExpired("precious", { v: 1 });
    const path = await fileFor("precious");
    const before = (await stat(path)).size;

    const cache = fileCache({ dir });
    for (let i = 0; i < 5; i++) await cache.get("precious");

    expect((await stat(path)).size).toBe(before);
  });

  test("an expired entry is overwritten by the next set()", async () => {
    await writeExpired("k", { v: "old" });
    const cache = fileCache({ dir });
    await cache.set("k", { v: "new" });
    expect(await cache.get("k")).toEqual({ v: "new" });
  });

  test("delete() removes the file", async () => {
    const cache = fileCache({ dir });
    await cache.set("gone", { v: 1 });
    const path = await fileFor("gone");
    await cache.delete("gone");
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test("a corrupt file reads as a miss instead of throwing", async () => {
    const cache = fileCache({ dir });
    await cache.set("bad", { v: 1 });
    await Bun.write(await fileFor("bad"), "{not json");
    expect(await cache.get("bad")).toBeUndefined();
  });
});

describe("withCache default ttl", () => {
  test("entries persist indefinitely when no ttl is given", async () => {
    const storage = fileCache({ dir });
    let calls = 0;
    const generate = withCache(
      async (_o: { prompt: string }) => {
        calls++;
        return { image: "bytes" };
      },
      { storage },
    );

    await generate({ prompt: "a lion", cacheKey: ["lion"] });
    expect(calls).toBe(1);

    // The default used to be "7d". Nothing about a cacheKey-addressed entry
    // goes stale with time — expiry only re-bills the user — so an entry
    // written now must still be a hit at any future date.
    const entries = await readdir(dir);
    const file = join(
      dir,
      entries.find((f) => f.endsWith(".json") && f.includes("lion"))!,
    );
    expect((await Bun.file(file).json()).expires).toBe(0);

    await generate({ prompt: "a lion", cacheKey: ["lion"] });
    expect(calls).toBe(1);
  });

  test("an explicit ttl is still honored", async () => {
    const storage = fileCache({ dir });
    let calls = 0;
    const generate = withCache(
      async (_o: { prompt: string }) => {
        calls++;
        return { image: "bytes" };
      },
      { storage, ttl: 1 },
    );

    await generate({ prompt: "a lion", cacheKey: ["lion"] });
    await new Promise((r) => setTimeout(r, 5));
    await generate({ prompt: "a lion", cacheKey: ["lion"] });

    expect(calls).toBe(2);
  });
});
