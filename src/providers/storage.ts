/**
 * Storage provider for Cloudflare R2 / S3 compatible storage
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export interface StorageConfig extends ProviderConfig {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  publicUrl?: string;
}

export class StorageProvider extends BaseProvider {
  readonly name = "storage";
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(config?: StorageConfig) {
    super(config);

    this.client = new S3Client({
      region: "auto",
      endpoint: config?.endpoint || process.env.CLOUDFLARE_R2_API_URL,
      credentials: {
        accessKeyId:
          config?.accessKeyId || process.env.CLOUDFLARE_ACCESS_KEY_ID || "",
        secretAccessKey:
          config?.secretAccessKey || process.env.CLOUDFLARE_ACCESS_SECRET || "",
      },
    });

    this.bucket = config?.bucket || process.env.CLOUDFLARE_R2_BUCKET || "m";
    this.publicUrl = config?.publicUrl || "https://s3.varg.ai";
  }

  async submit(
    _model: string,
    _inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const jobId = `storage_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return jobId;
  }

  async getStatus(_jobId: string): Promise<JobStatusUpdate> {
    return { status: "completed" };
  }

  async getResult(_jobId: string): Promise<unknown> {
    return null;
  }

  // ============================================================================
  // Storage Operations
  // ============================================================================

  /**
   * Upload a file from local path to storage
   */
  async uploadLocalFile(filePath: string, objectKey: string): Promise<string> {
    console.log(`[storage] uploading ${filePath} to ${objectKey}`);

    const file = Bun.file(filePath);
    const buffer = await file.arrayBuffer();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: new Uint8Array(buffer),
      }),
    );

    return this.getPublicUrl(objectKey);
  }

  /**
   * Upload content from a URL to storage
   */
  async uploadFromUrl(url: string, objectKey: string): Promise<string> {
    console.log(`[storage] uploading from URL to ${objectKey}`);

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: new Uint8Array(buffer),
      }),
    );

    return this.getPublicUrl(objectKey);
  }

  /**
   * Upload raw buffer to storage
   */
  async uploadBuffer(
    buffer: ArrayBuffer | Uint8Array,
    objectKey: string,
    contentType?: string,
  ): Promise<string> {
    console.log(`[storage] uploading buffer to ${objectKey}`);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
        ContentType: contentType,
      }),
    );

    return this.getPublicUrl(objectKey);
  }

  /**
   * Generate a presigned URL for temporary access
   */
  async generatePresignedUrl(
    objectKey: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Get the public URL for an object
   */
  getPublicUrl(objectKey: string): string {
    const endpoint = process.env.CLOUDFLARE_R2_API_URL || "";

    if (endpoint.includes("localhost")) {
      return `${endpoint}/${objectKey}`;
    }

    return `${this.publicUrl}/${objectKey}`;
  }

  /**
   * Download a file from storage
   */
  async downloadToFile(objectKey: string, outputPath: string): Promise<string> {
    console.log(`[storage] downloading ${objectKey} to ${outputPath}`);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    const response = await this.client.send(command);
    const body = response.Body;

    if (!body) {
      throw new Error("Empty response body");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    // @ts-expect-error - body is a readable stream
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await Bun.write(outputPath, buffer);
    console.log(`[storage] saved to ${outputPath}`);

    return outputPath;
  }
}

// Export singleton instance
export const storageProvider = new StorageProvider();

// Re-export convenience functions for backward compatibility
export const uploadFile = (filePath: string, objectKey: string) =>
  storageProvider.uploadLocalFile(filePath, objectKey);
export const uploadFromUrl = (url: string, objectKey: string) =>
  storageProvider.uploadFromUrl(url, objectKey);
export const uploadBuffer = (
  buffer: ArrayBuffer | Uint8Array,
  objectKey: string,
  contentType?: string,
) => storageProvider.uploadBuffer(buffer, objectKey, contentType);
export const generatePresignedUrl = (objectKey: string, expiresIn?: number) =>
  storageProvider.generatePresignedUrl(objectKey, expiresIn);
export const getPublicUrl = (objectKey: string) =>
  storageProvider.getPublicUrl(objectKey);
