import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageProvider } from "./types";

export interface R2StorageOptions {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  publicUrl?: string;
}

export function r2Storage(options?: R2StorageOptions): StorageProvider {
  const endpoint = options?.endpoint ?? process.env.CLOUDFLARE_R2_API_URL;
  const accessKeyId =
    options?.accessKeyId ?? process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const secretAccessKey =
    options?.secretAccessKey ?? process.env.CLOUDFLARE_ACCESS_SECRET;
  const bucket = options?.bucket ?? process.env.CLOUDFLARE_R2_BUCKET ?? "m";
  const publicUrl = options?.publicUrl ?? "https://s3.varg.ai";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage requires endpoint, accessKeyId, and secretAccessKey. " +
        "Set CLOUDFLARE_R2_API_URL, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_ACCESS_SECRET env vars " +
        "or pass options to r2Storage().",
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const getPublicUrl = (objectKey: string): string => {
    if (endpoint.includes("localhost")) {
      return `${endpoint}/${objectKey}`;
    }
    return `${publicUrl}/${objectKey}`;
  };

  return {
    async upload(data: Uint8Array, key: string, mediaType: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: mediaType,
        }),
      );
      return getPublicUrl(key);
    },
  };
}
