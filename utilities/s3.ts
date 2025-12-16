#!/usr/bin/env bun
/**
 * cloudflare r2 / s3 storage wrapper
 * usage: bun run utilities/s3.ts <command> <args>
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_API_URL,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_ACCESS_SECRET || "",
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "m";

export async function uploadFile(
  filePath: string,
  objectKey: string,
): Promise<string> {
  console.log(`[s3] uploading ${filePath} to ${objectKey}`);

  const file = Bun.file(filePath);
  const buffer = await file.arrayBuffer();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: new Uint8Array(buffer),
    }),
  );

  return getPublicUrl(objectKey);
}

export async function uploadFromUrl(
  url: string,
  objectKey: string,
): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: new Uint8Array(buffer),
    }),
  );

  return getPublicUrl(objectKey);
}

export async function generatePresignedUrl(
  objectKey: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

export function getPublicUrl(objectKey: string): string {
  const endpoint = process.env.CLOUDFLARE_R2_API_URL || "";

  if (endpoint.includes("localhost")) {
    return `${endpoint}/${objectKey}`;
  }

  return `https://s3.varg.ai/${objectKey}`;
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "upload": {
      if (!args[0] || !args[1]) {
        console.log(`
usage:
  bun run utilities/s3.ts upload <filePath> <objectKey>
        `);
        process.exit(1);
      }
      const uploadResult = await uploadFile(args[0], args[1]);
      console.log(uploadResult);
      break;
    }

    case "upload_from_url": {
      if (!args[0] || !args[1]) {
        console.log(`
usage:
  bun run utilities/s3.ts upload_from_url <url> <objectKey>
        `);
        process.exit(1);
      }
      const urlUploadResult = await uploadFromUrl(args[0], args[1]);
      console.log(urlUploadResult);
      break;
    }

    case "presigned_url": {
      if (!args[0]) {
        console.log(`
usage:
  bun run utilities/s3.ts presigned_url <objectKey> [expiresIn]
        `);
        process.exit(1);
      }
      const expiresIn = args[1] ? Number.parseInt(args[1], 10) : 3600;
      if (Number.isNaN(expiresIn)) {
        console.error("expiresIn must be a valid number");
        process.exit(1);
      }
      const presignedUrl = await generatePresignedUrl(args[0], expiresIn);
      console.log(presignedUrl);
      break;
    }

    default:
      console.log(`
usage:
  bun run utilities/s3.ts upload <filePath> <objectKey>
  bun run utilities/s3.ts upload_from_url <url> <objectKey>
  bun run utilities/s3.ts presigned_url <objectKey> [expiresIn]
      `);
      process.exit(1);
  }
}
