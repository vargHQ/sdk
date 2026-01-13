import type { ImageModelV3File } from "@ai-sdk/provider";
import type { VideoModelV3File } from "./video-model";

/**
 * Helper to create a VideoModelV3File or ImageModelV3File from various inputs.
 *
 * Supports:
 * - File path (string) - reads from disk
 * - URL (string starting with http/https) - creates URL reference
 * - Uint8Array - raw binary data
 * - ArrayBuffer - converts to Uint8Array
 * - Blob - reads as ArrayBuffer
 *
 * @example
 * ```ts
 * // From file path
 * const file = await createFile("media/image.png");
 *
 * // From URL
 * const file = await createFile("https://example.com/image.png");
 *
 * // From buffer
 * const file = await createFile(uint8Array, "image/png");
 * ```
 */
export async function createFile(
  input: string | Uint8Array | ArrayBuffer | Blob,
  mediaType?: string,
): Promise<VideoModelV3File> {
  // URL input
  if (typeof input === "string" && /^https?:\/\//.test(input)) {
    return {
      type: "url",
      url: input,
      mediaType: mediaType ?? inferMediaType(input),
    };
  }

  // File path input
  if (typeof input === "string") {
    const file = Bun.file(input);
    const data = new Uint8Array(await file.arrayBuffer());
    return {
      type: "file",
      mediaType: mediaType ?? file.type ?? inferMediaType(input),
      data,
    };
  }

  // Blob input
  if (input instanceof Blob) {
    const data = new Uint8Array(await input.arrayBuffer());
    return {
      type: "file",
      mediaType: mediaType ?? input.type ?? "application/octet-stream",
      data,
    };
  }

  // ArrayBuffer input
  if (input instanceof ArrayBuffer) {
    return {
      type: "file",
      mediaType: mediaType ?? "application/octet-stream",
      data: new Uint8Array(input),
    };
  }

  // Uint8Array input
  return {
    type: "file",
    mediaType: mediaType ?? "application/octet-stream",
    data: input,
  };
}

/**
 * Create multiple files from an array of inputs.
 */
export async function createFiles(
  inputs: Array<
    | string
    | Uint8Array
    | ArrayBuffer
    | Blob
    | { input: string | Uint8Array | ArrayBuffer | Blob; mediaType?: string }
  >,
): Promise<VideoModelV3File[]> {
  return Promise.all(
    inputs.map((item) => {
      if (typeof item === "object" && "input" in item) {
        return createFile(item.input, item.mediaType);
      }
      return createFile(item);
    }),
  );
}

/**
 * Infer media type from file path or URL.
 */
function inferMediaType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    // Video
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return mimeTypes[ext ?? ""] ?? "application/octet-stream";
}
