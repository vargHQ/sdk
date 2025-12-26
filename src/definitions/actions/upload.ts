/**
 * Upload action
 * Upload files to S3/R2 storage
 */

import { existsSync } from "node:fs";
import { basename, extname } from "node:path";
import { z } from "zod";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { storageProvider } from "../../providers/storage";

// Input schema
const uploadInputSchema = z.object({
  file: z.string().describe("Local file path or URL to upload"),
  key: z
    .string()
    .optional()
    .describe("Object key/path in storage (auto-generated if not provided)"),
});

// Output schema
const uploadOutputSchema = z.object({
  url: z.string().describe("Public URL of the uploaded file"),
  key: z.string().describe("Object key in storage"),
});

// Schema object for the definition
const schema: ZodSchema<typeof uploadInputSchema, typeof uploadOutputSchema> = {
  input: uploadInputSchema,
  output: uploadOutputSchema,
};

export interface UploadOptions {
  key?: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Generate a unique object key based on file info
 */
function generateObjectKey(source: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Extract extension from source
  let ext = extname(source);
  if (!ext) {
    // Try to guess from URL or default to .bin
    if (source.includes(".")) {
      const parts = source.split(".");
      ext = `.${parts[parts.length - 1]?.split("?")[0] || "bin"}`;
    } else {
      ext = ".bin";
    }
  }

  const name = basename(source, ext).slice(0, 20) || "file";
  return `uploads/${timestamp}-${random}-${name}${ext}`;
}

/**
 * Check if a string is a URL
 */
function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Upload a file to storage
 */
export async function upload(
  file: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const key = options.key || generateObjectKey(file);

  if (isUrl(file)) {
    console.log(`[upload] uploading from URL: ${file}`);
    const url = await storageProvider.uploadFromUrl(file, key);
    console.log(`[upload] uploaded to ${url}`);
    return { url, key };
  }

  // Local file
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  console.log(`[upload] uploading local file: ${file}`);
  const url = await storageProvider.uploadLocalFile(file, key);
  console.log(`[upload] uploaded to ${url}`);
  return { url, key };
}

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "upload",
  description: "Upload file to S3/R2 storage",
  schema,
  execute: async (inputs) => {
    const { file, key } = inputs;
    return upload(file, { key });
  },
};

export default definition;
