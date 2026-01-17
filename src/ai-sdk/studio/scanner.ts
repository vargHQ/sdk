import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CacheEntry, CacheItem, ImageData, VideoData } from "./types";

function extractBase64(data: ImageData | VideoData): string | null {
  if (
    "uint8ArrayData" in data &&
    data.uint8ArrayData?.__type === "Uint8Array"
  ) {
    return data.uint8ArrayData.data;
  }
  if ("_data" in data && data._data?.__type === "Uint8Array") {
    return data._data.data;
  }
  if ("base64" in data && data.base64) {
    return data.base64;
  }
  return null;
}

function detectMediaType(
  filename: string,
  value: unknown,
): "image" | "video" | "unknown" {
  if (filename.startsWith("generateImage")) return "image";
  if (filename.startsWith("generateVideo")) return "video";

  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("images" in v) return "image";
    if ("video" in v) return "video";
  }

  return "unknown";
}

export async function scanCacheFolder(cacheDir: string): Promise<CacheItem[]> {
  const items: CacheItem[] = [];

  try {
    const files = await readdir(cacheDir);

    for (const file of files) {
      if (!file.endsWith(".json") || file === ".gitkeep") continue;

      const filePath = join(cacheDir, file);
      const fileStat = await stat(filePath);

      try {
        const content = await Bun.file(filePath).text();
        const entry = JSON.parse(content) as CacheEntry;
        const type = detectMediaType(file, entry.value);

        items.push({
          id: file.replace(".json", ""),
          filename: file,
          type,
          size: fileStat.size,
          createdAt: fileStat.mtime,
          metadata: { expires: entry.expires },
        });
      } catch {}
    }
  } catch (err) {
    console.error("failed to scan cache folder:", err);
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getCacheItemMedia(
  cacheDir: string,
  id: string,
): Promise<{ type: "image" | "video"; data: string; mimeType: string } | null> {
  const filePath = join(cacheDir, `${id}.json`);

  try {
    const content = await Bun.file(filePath).text();
    const entry = JSON.parse(content) as CacheEntry;
    const value = entry.value as Record<string, unknown>;

    if ("images" in value && Array.isArray(value.images)) {
      const firstImage = value.images[0] as ImageData;
      const base64 = extractBase64(firstImage);
      if (base64) {
        return { type: "image", data: base64, mimeType: "image/jpeg" };
      }
    }

    if ("video" in value && typeof value.video === "object") {
      const video = value.video as VideoData;
      const base64 = extractBase64(video);
      if (base64) {
        return { type: "video", data: base64, mimeType: "video/mp4" };
      }
    }

    return null;
  } catch {
    return null;
  }
}
