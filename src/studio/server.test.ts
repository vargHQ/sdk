// POST /api/render runs the code it is sent. Studio used to listen on every
// interface with no check, so anyone on the network — or any web page, via a
// cross-site POST to localhost — could run code on the machine.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { createStudioServer } from "./server";

let studio: ReturnType<typeof createStudioServer>;
let base: string;
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "varg-studio-"));
  studio = createStudioServer({ port: 0, outputDir: dir, cacheDir: dir });
  base = `http://127.0.0.1:${studio.port}`;
});

afterAll(() => {
  studio.server.stop(true);
  rmSync(dir, { recursive: true, force: true });
});

const render = (headers: Record<string, string>) =>
  fetch(`${base}/api/render`, {
    method: "POST",
    headers: { "content-type": "text/plain", ...headers },
    body: JSON.stringify({ code: "throw 1" }),
    redirect: "manual",
  });

describe("studio is loopback-only and needs its token", () => {
  test("the printed URL carries the token", () => {
    expect(studio.url).toBe(`${base}/?token=${studio.token}`);
    expect(studio.token.length).toBeGreaterThanOrEqual(32);
  });

  test("no token → 401, nothing runs", async () => {
    expect((await render({})).status).toBe(401);
    expect((await fetch(`${base}/`)).status).toBe(401);
  });

  test("a foreign Host (DNS rebinding) → 403 even with the token", async () => {
    const res = await render({
      host: `evil.example:${studio.port}`,
      authorization: `Bearer ${studio.token}`,
    });
    expect(res.status).toBe(403);
  });

  test("the token link sets a strict cookie and drops the token from the URL", async () => {
    const res = await fetch(`${base}/editor?token=${studio.token}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/editor");
    expect(res.headers.get("set-cookie")).toContain(
      "HttpOnly; SameSite=Strict",
    );
    const items = await fetch(`${base}/api/items`, {
      headers: { cookie: `varg_studio=${studio.token}` },
    });
    expect(items.status).toBe(200);
  });

  test("not reachable on a non-loopback address", async () => {
    const lan = Object.values(networkInterfaces())
      .flat()
      .find((i) => i && i.family === "IPv4" && !i.internal)?.address;
    if (!lan) return;
    let reached = false;
    try {
      await fetch(`http://${lan}:${studio.port}/`, {
        signal: AbortSignal.timeout(1500),
      });
      reached = true;
    } catch {}
    expect(reached).toBe(false);
  });
});
