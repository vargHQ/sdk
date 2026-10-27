/**
 * `withCache`'s optional concurrency limiter (sdk#225).
 *
 * The limiter guards the expensive underlying call only — cache hits must
 * never queue for a slot, or a fully cached render would serialize its
 * cache reads behind a semaphore that exists to protect API traffic.
 */

import { describe, expect, test } from "bun:test";
import pLimit from "p-limit";
import { type CacheStorage, withCache } from "./cache";

function createMemoryCache(): CacheStorage & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(key) {
      return store.get(key);
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

/** Async fn that records peak overlap. */
function makeTrackedFn(latencyMs = 10) {
  const state = { active: 0, maxActive: 0, calls: 0 };
  const fn = async (options: { id: number }) => {
    state.calls++;
    state.active++;
    state.maxActive = Math.max(state.maxActive, state.active);
    await new Promise((r) => setTimeout(r, latencyMs));
    state.active--;
    return { value: options.id };
  };
  return { fn, state };
}

describe("withCache limit option", () => {
  test("caps concurrent underlying calls on cache miss", async () => {
    const { fn, state } = makeTrackedFn();
    const cached = withCache(fn, {
      storage: createMemoryCache(),
      limit: pLimit(2),
    });

    await Promise.all(
      [1, 2, 3, 4, 5, 6].map((id) => cached({ id, cacheKey: [`k${id}`] })),
    );

    expect(state.calls).toBe(6);
    expect(state.maxActive).toBe(2);
  });

  test("cache hits bypass the limiter entirely", async () => {
    const { fn, state } = makeTrackedFn();
    const storage = createMemoryCache();
    const warm = withCache(fn, { storage, limit: pLimit(4) });
    await Promise.all(
      [1, 2, 3, 4].map((id) => warm({ id, cacheKey: [`hit${id}`] })),
    );
    expect(state.calls).toBe(4);

    // A limit of 1 would serialize these if hits took slots; the call
    // count staying flat proves the underlying fn was never invoked.
    const cold = withCache(fn, { storage, limit: pLimit(1) });
    const results = await Promise.all(
      [1, 2, 3, 4].map((id) => cold({ id, cacheKey: [`hit${id}`] })),
    );

    expect(state.calls).toBe(4);
    expect(results.map((r) => r.value)).toEqual([1, 2, 3, 4]);
  });

  test("limits uncached calls too (no cacheKey)", async () => {
    // Without a cacheKey withCache passes straight through — that path
    // still hits the API, so it must still respect the limit.
    const { fn, state } = makeTrackedFn();
    const cached = withCache(fn, {
      storage: createMemoryCache(),
      limit: pLimit(2),
    });

    await Promise.all([1, 2, 3, 4, 5].map((id) => cached({ id })));

    expect(state.calls).toBe(5);
    expect(state.maxActive).toBe(2);
  });

  test("omitting limit preserves unbounded behavior", async () => {
    const { fn, state } = makeTrackedFn();
    const cached = withCache(fn, { storage: createMemoryCache() });

    await Promise.all(
      [1, 2, 3, 4, 5].map((id) => cached({ id, cacheKey: [`u${id}`] })),
    );

    expect(state.maxActive).toBe(5);
  });

  test("a rejected call releases its slot", async () => {
    let calls = 0;
    const fn = async ({ id }: { id: number }) => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      if (id === 1) throw new Error("boom");
      return { value: id };
    };
    const cached = withCache(fn, {
      storage: createMemoryCache(),
      limit: pLimit(1),
    });

    const settled = await Promise.allSettled(
      [1, 2, 3].map((id) => cached({ id, cacheKey: [`e${id}`] })),
    );

    // A leaked slot would deadlock the remaining calls instead of settling.
    expect(settled[0]!.status).toBe("rejected");
    expect(settled[1]!.status).toBe("fulfilled");
    expect(settled[2]!.status).toBe("fulfilled");
    expect(calls).toBe(3);
  });
});
