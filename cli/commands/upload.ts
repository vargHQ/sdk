/**
 * varg upload command
 * upload local files to cloudflare r2 storage
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { defineCommand } from "citty";
import { uploadFile } from "../../utilities/s3";
import { box, c, error, formatDuration, row, success } from "../ui";

/**
 * Get file type category from extension
 */
function getFileType(ext: string): string {
  const normalized = ext.toLowerCase();

  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
  const videoExts = [".mp4", ".mpeg", ".mpg", ".mov", ".avi", ".webm", ".mkv"];
  const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"];

  if (imageExts.includes(normalized)) return "image";
  if (videoExts.includes(normalized)) return "video";
  if (audioExts.includes(normalized)) return "audio";

  return "file";
}

/**
 * Create URL-safe slug from filename
 */
function slugify(text: string, maxLength = 40): string {
  return (
    text
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, maxLength)
      .replace(/-$/, "") || "file"
  );
}

/**
 * Format file size in human readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Generate S3 object key from file path and optional destination
 */
function generateObjectKey(filePath: string, destination?: string): string {
  const filename = path.basename(filePath);

  if (destination) {
    // If ends with "/", append original filename
    if (destination.endsWith("/")) {
      return `${destination}${filename}`;
    }
    // Use destination as-is (full path specified)
    return destination;
  }

  // Auto-generate path: uploads/{type}s/{slug}_{uuid}.{ext}
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  const fileType = getFileType(ext);
  const slug = slugify(basename);
  const uuid = crypto.randomUUID().slice(0, 8);

  return `uploads/${fileType}s/${slug}_${uuid}${ext}`;
}

export const uploadCmd = defineCommand({
  meta: {
    name: "upload",
    description: "upload local file to cloud storage",
  },
  args: {
    file: {
      type: "positional",
      description: "local file path to upload",
      required: true,
    },
    destination: {
      type: "string",
      alias: "d",
      description:
        "s3 destination path (e.g. users/123/video.mp4 or projects/abc/)",
    },
    json: {
      type: "boolean",
      description: "output result as json",
    },
    quiet: {
      type: "boolean",
      description: "minimal output",
    },
  },
  async run({ args }) {
    const { file: filePath, destination, json, quiet } = args;

    // Validate file exists
    if (!filePath || !existsSync(filePath)) {
      if (json) {
        console.log(
          JSON.stringify({ success: false, error: "file not found" }),
        );
      } else {
        console.error(`${c.red("error:")} file not found: ${filePath}`);
      }
      process.exit(1);
    }

    // Get file info
    const stats = statSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath);
    const fileType = getFileType(ext);
    const fileSize = stats.size;

    // Generate object key
    const objectKey = generateObjectKey(filePath, destination);

    // Show progress
    if (!quiet && !json) {
      const content = [
        "",
        row("file", filename),
        row("size", formatSize(fileSize)),
        row("type", fileType),
        "",
        `  ${c.cyan("◐")} uploading...`,
        "",
      ];
      console.log(box("upload", content));
    }

    const startTime = Date.now();

    try {
      const url = await uploadFile(filePath, objectKey);
      const elapsed = Date.now() - startTime;

      if (json) {
        console.log(
          JSON.stringify({
            success: true,
            file: filename,
            size: fileSize,
            type: fileType,
            destination: objectKey,
            url,
            time: elapsed,
          }),
        );
      } else if (quiet) {
        console.log(url);
      } else {
        // Clear and show result
        console.log("\x1b[2J\x1b[H");

        const content = [
          "",
          row("file", filename),
          row("size", formatSize(fileSize)),
          row("type", fileType),
          "",
          success(`uploaded in ${formatDuration(elapsed)}`),
          "",
          row("destination", objectKey),
          "",
        ];

        console.log(box("upload", content));
        console.log(`\n  ${c.cyan("url")}  ${url}\n`);
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (json) {
        console.log(
          JSON.stringify({ success: false, error: errorMsg, time: elapsed }),
        );
      } else if (quiet) {
        console.error(errorMsg);
      } else {
        console.log("\x1b[2J\x1b[H");

        const content = [
          "",
          row("file", filename),
          row("size", formatSize(fileSize)),
          row("type", fileType),
          "",
          error("upload failed"),
          "",
          row("error", errorMsg),
          "",
        ];

        console.log(box("upload", content));
      }

      process.exit(1);
    }
  },
});
