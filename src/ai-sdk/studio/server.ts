import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { getCacheItemMedia, scanCacheFolder } from "./scanner";
import { extractStages, serializeStages } from "./stages";
import {
  createStepSession,
  deleteSession,
  executeNextStage,
  executeStage,
  getSession,
  getSessionStatus,
  getStagePreviewPath,
} from "./step-renderer";
import type { CacheItem, RenderProgress, RenderRequest } from "./types";

const DEFAULT_CACHE_DIR = ".cache/ai";
const DEFAULT_OUTPUT_DIR = "output/studio";
const DEFAULT_SHARES_DIR = "output/studio/shares";

interface StudioConfig {
  cacheDir: string;
  outputDir: string;
  port: number;
  initialFile?: string;
}

interface ShareData {
  code: string;
  videoUrl?: string;
  createdAt: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  filename: string;
}

function fileNameToReadable(filename: string): string {
  return basename(filename, ".tsx")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toLowerCase());
}

function scanTemplates(dir: string): TemplateInfo[] {
  const templates: TemplateInfo[] = [];

  if (!existsSync(dir)) return templates;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".tsx") &&
      !entry.name.startsWith("_")
    ) {
      const id = basename(entry.name, ".tsx");
      templates.push({
        id,
        name: fileNameToReadable(entry.name),
        filename: entry.name,
      });
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export function createStudioServer(config: Partial<StudioConfig> = {}) {
  const cacheDir = resolve(config.cacheDir ?? DEFAULT_CACHE_DIR);
  const outputDir = resolve(config.outputDir ?? DEFAULT_OUTPUT_DIR);
  const sharesDir = resolve(DEFAULT_SHARES_DIR);
  const port = config.port ?? 8282;
  const initialFile = config.initialFile;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  if (!existsSync(sharesDir)) {
    mkdirSync(sharesDir, { recursive: true });
  }

  let cachedItems: CacheItem[] = [];

  async function refreshCache() {
    if (existsSync(cacheDir)) {
      cachedItems = await scanCacheFolder(cacheDir);
    }
  }

  const activeRenders = new Map<string, AbortController>();

  async function executeRender(
    code: string,
    renderId: string,
    onProgress: (progress: RenderProgress) => void,
    _signal: AbortSignal,
  ): Promise<string> {
    const outputPath = join(outputDir, `${renderId}.mp4`);
    const tempDir = join(import.meta.dir, "../examples");
    const tempFile = join(tempDir, `_studio_${renderId}.tsx`);

    onProgress({ step: "parsing", progress: 0, message: "parsing code..." });
    await Bun.write(tempFile, code);
    onProgress({
      step: "rendering",
      progress: 0.1,
      message: "starting render...",
    });

    try {
      console.log(`[render] importing ${tempFile}`);
      const mod = await import(tempFile);
      const element = mod.default;

      if (
        !element ||
        typeof element !== "object" ||
        element.type !== "render"
      ) {
        throw new Error("file must export a <Render> element as default");
      }

      console.log("[render] starting render pipeline");
      const { render } = await import("../react/render");

      await render(element, {
        output: outputPath,
        cache: cacheDir,
        quiet: false,
      });

      console.log(`[render] complete: ${outputPath}`);
      onProgress({ step: "complete", progress: 1, message: "done!" });
      return outputPath;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[render] error: ${msg}`);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
      throw new Error(msg);
    } finally {
      try {
        if (await Bun.file(tempFile).exists()) {
          await Bun.$`rm ${tempFile}`;
        }
      } catch {}
    }
  }

  const server = Bun.serve({
    port,
    idleTimeout: 255,
    async fetch(req) {
      const url = new URL(req.url);
      const method = req.method;
      const path = url.pathname;

      if (path.startsWith("/api/")) {
        console.log(`${method} ${path}`);
      }

      if (url.pathname === "/" || url.pathname === "/editor") {
        const html = await Bun.file(
          join(import.meta.dir, "ui/index.html"),
        ).text();
        return new Response(html, { headers: { "content-type": "text/html" } });
      }

      if (url.pathname === "/cache") {
        const html = await Bun.file(
          join(import.meta.dir, "ui/cache.html"),
        ).text();
        return new Response(html, { headers: { "content-type": "text/html" } });
      }

      if (url.pathname === "/api/items") {
        await refreshCache();
        return Response.json(cachedItems);
      }

      if (url.pathname.startsWith("/api/media/")) {
        const id = decodeURIComponent(url.pathname.replace("/api/media/", ""));
        const media = await getCacheItemMedia(cacheDir, id);
        if (!media) return new Response("not found", { status: 404 });
        const buffer = Buffer.from(media.data, "base64");
        return new Response(buffer, {
          headers: { "content-type": media.mimeType },
        });
      }

      if (url.pathname === "/api/initial-code") {
        if (!initialFile) {
          return Response.json({ code: null });
        }
        const file = Bun.file(initialFile);
        if (!(await file.exists())) {
          return Response.json({ code: null, error: "file not found" });
        }
        const code = await file.text();
        return Response.json({ code, path: initialFile });
      }

      if (url.pathname === "/api/templates") {
        const examplesDir = join(import.meta.dir, "../examples");
        const templates = scanTemplates(examplesDir).map((t) => ({
          id: t.id,
          name: t.name,
        }));
        return Response.json(templates);
      }

      if (url.pathname.startsWith("/api/templates/")) {
        const id = url.pathname.replace("/api/templates/", "");
        const examplesDir = join(import.meta.dir, "../examples");
        const templates = scanTemplates(examplesDir);
        const template = templates.find((t) => t.id === id);
        if (!template) return new Response("not found", { status: 404 });
        const code = await Bun.file(
          join(examplesDir, template.filename),
        ).text();
        return Response.json({ code });
      }

      if (url.pathname === "/api/render" && req.method === "POST") {
        const body = (await req.json()) as RenderRequest;
        const renderId = `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const controller = new AbortController();
        activeRenders.set(renderId, controller);

        const stream = new ReadableStream({
          async start(streamController) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown) => {
              streamController.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                ),
              );
            };

            try {
              send("start", { renderId });
              const _outputPath = await executeRender(
                body.code,
                renderId,
                (progress) => send("progress", progress),
                controller.signal,
              );
              send("complete", { videoUrl: `/api/output/${renderId}.mp4` });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "unknown error";
              send("error", { message });
            } finally {
              activeRenders.delete(renderId);
              streamController.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      }

      if (url.pathname.startsWith("/api/render/") && req.method === "DELETE") {
        const renderId = url.pathname.replace("/api/render/", "");
        const controller = activeRenders.get(renderId);
        if (controller) {
          controller.abort();
          activeRenders.delete(renderId);
          return Response.json({ stopped: true });
        }
        return Response.json({ stopped: false });
      }

      if (url.pathname.startsWith("/api/output/")) {
        const filename = url.pathname.replace("/api/output/", "");
        const filePath = join(outputDir, filename);
        const file = Bun.file(filePath);
        if (!(await file.exists()))
          return new Response("not found", { status: 404 });
        return new Response(file, { headers: { "content-type": "video/mp4" } });
      }

      if (url.pathname === "/api/share" && req.method === "POST") {
        const body = (await req.json()) as { code: string; videoUrl?: string };
        const shareId = Math.random().toString(36).slice(2, 10);
        const shareData: ShareData = {
          code: body.code,
          videoUrl: body.videoUrl,
          createdAt: new Date().toISOString(),
        };
        await Bun.write(
          join(sharesDir, `${shareId}.json`),
          JSON.stringify(shareData),
        );
        return Response.json({ shareId, url: `/s/${shareId}` });
      }

      if (url.pathname.startsWith("/api/share/")) {
        const shareId = url.pathname.replace("/api/share/", "");
        const sharePath = join(sharesDir, `${shareId}.json`);
        const file = Bun.file(sharePath);
        if (!(await file.exists()))
          return new Response("not found", { status: 404 });
        const data = await file.json();
        return Response.json(data);
      }

      if (url.pathname.startsWith("/s/")) {
        const html = await Bun.file(
          join(import.meta.dir, "ui/index.html"),
        ).text();
        return new Response(html, { headers: { "content-type": "text/html" } });
      }

      if (url.pathname === "/api/step/stages" && req.method === "POST") {
        const body = (await req.json()) as { code: string };
        const tempDir = join(import.meta.dir, "../examples");
        const tempFile = join(tempDir, `_stages_${Date.now()}.tsx`);

        try {
          await Bun.write(tempFile, body.code);
          const mod = await import(tempFile);
          const element = mod.default;

          if (
            !element ||
            typeof element !== "object" ||
            element.type !== "render"
          ) {
            return Response.json(
              { error: "file must export a <Render> element as default" },
              { status: 400 },
            );
          }

          const extracted = extractStages(element);
          const serialized = serializeStages(extracted);

          return Response.json(serialized);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        } finally {
          try {
            if (await Bun.file(tempFile).exists()) {
              await Bun.$`rm ${tempFile}`;
            }
          } catch {}
        }
      }

      if (url.pathname === "/api/step/session" && req.method === "POST") {
        const body = (await req.json()) as { code: string };
        const tempDir = join(import.meta.dir, "../examples");
        const tempFile = join(tempDir, `_session_${Date.now()}.tsx`);

        try {
          await Bun.write(tempFile, body.code);
          const mod = await import(tempFile);
          const element = mod.default;

          if (
            !element ||
            typeof element !== "object" ||
            element.type !== "render"
          ) {
            return Response.json(
              { error: "file must export a <Render> element as default" },
              { status: 400 },
            );
          }

          const session = createStepSession(body.code, element, cacheDir);
          const status = getSessionStatus(session);

          return Response.json(status);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        } finally {
          try {
            if (await Bun.file(tempFile).exists()) {
              await Bun.$`rm ${tempFile}`;
            }
          } catch {}
        }
      }

      if (url.pathname === "/api/step/next" && req.method === "POST") {
        const body = (await req.json()) as { sessionId: string };
        const session = getSession(body.sessionId);

        if (!session) {
          return Response.json({ error: "session not found" }, { status: 404 });
        }

        try {
          const result = await executeNextStage(session);

          if (!result) {
            return Response.json({
              done: true,
              status: getSessionStatus(session),
            });
          }

          return Response.json({
            done: false,
            stage: {
              id: result.stage.id,
              type: result.stage.type,
              label: result.stage.label,
              status: result.stage.status,
            },
            result: result.result,
            isLast: result.isLast,
            status: getSessionStatus(session),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json(
            { error: message, status: getSessionStatus(session) },
            { status: 500 },
          );
        }
      }

      if (url.pathname === "/api/step/run" && req.method === "POST") {
        const body = (await req.json()) as {
          sessionId: string;
          stageId: string;
        };
        const session = getSession(body.sessionId);

        if (!session) {
          return Response.json({ error: "session not found" }, { status: 404 });
        }

        try {
          const result = await executeStage(session, body.stageId);
          return Response.json({
            result,
            status: getSessionStatus(session),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json(
            { error: message, status: getSessionStatus(session) },
            { status: 500 },
          );
        }
      }

      if (
        url.pathname.match(/^\/api\/step\/preview\/[^/]+\/[^/]+$/) &&
        req.method === "GET"
      ) {
        const parts = url.pathname.split("/");
        const sessionId = parts[4];
        const stageId = parts[5];

        if (!sessionId || !stageId) {
          return new Response("invalid path", { status: 400 });
        }

        const session = getSession(sessionId);
        if (!session) {
          return new Response("session not found", { status: 404 });
        }

        const previewPath = getStagePreviewPath(session, stageId);
        if (!previewPath) {
          return new Response("preview not found", { status: 404 });
        }

        const file = Bun.file(previewPath);
        if (!(await file.exists())) {
          return new Response("file not found", { status: 404 });
        }

        const mimeType = previewPath.endsWith(".mp4")
          ? "video/mp4"
          : previewPath.endsWith(".mp3")
            ? "audio/mp3"
            : "image/png";

        return new Response(file, { headers: { "content-type": mimeType } });
      }

      if (
        url.pathname.match(/^\/api\/step\/session\/[^/]+$/) &&
        req.method === "GET"
      ) {
        const sessionId = url.pathname.split("/").pop();
        if (!sessionId) {
          return new Response("invalid path", { status: 400 });
        }

        const session = getSession(sessionId);
        if (!session) {
          return Response.json({ error: "session not found" }, { status: 404 });
        }

        return Response.json(getSessionStatus(session));
      }

      if (
        url.pathname.match(/^\/api\/step\/session\/[^/]+$/) &&
        req.method === "DELETE"
      ) {
        const sessionId = url.pathname.split("/").pop();
        if (!sessionId) {
          return new Response("invalid path", { status: 400 });
        }

        deleteSession(sessionId);
        return Response.json({ deleted: true });
      }

      if (url.pathname === "/api/step/render" && req.method === "POST") {
        const body = (await req.json()) as { sessionId: string };
        const session = getSession(body.sessionId);

        if (!session) {
          return Response.json({ error: "session not found" }, { status: 404 });
        }

        try {
          const { finalizeRender } = await import("./step-renderer");
          const videoPath = await finalizeRender(session, outputDir);
          const videoUrl = `/api/output/${videoPath.split("/").pop()}`;
          return Response.json({ videoUrl, path: videoPath });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      }

      return new Response("not found", { status: 404 });
    },
  });

  return { server, port };
}
