import type { ImageModelV3File } from "@ai-sdk/provider";
import type { StorageProvider } from "./storage/types";

export class File {
  private _data: Uint8Array | null = null;
  private _url: string | null = null;
  private _mediaType: string;
  private _loader: (() => Promise<Uint8Array>) | null = null;

  private constructor(
    options:
      | { data: Uint8Array; mediaType: string; url?: string }
      | { url: string; mediaType?: string }
      | { loader: () => Promise<Uint8Array>; mediaType: string },
  ) {
    if ("data" in options) {
      this._data = options.data;
      this._mediaType = options.mediaType;
      this._url = options.url ?? null;
    } else if ("url" in options) {
      this._url = options.url;
      this._mediaType = options.mediaType ?? inferMediaType(options.url);
    } else {
      this._loader = options.loader;
      this._mediaType = options.mediaType;
    }
  }

  static fromPath(path: string, mediaType?: string): File {
    const resolvedMediaType = mediaType ?? inferMediaType(path);
    return new File({
      loader: async () => {
        const file = Bun.file(path);
        return new Uint8Array(await file.arrayBuffer());
      },
      mediaType: resolvedMediaType,
    });
  }

  static fromUrl(url: string, mediaType?: string): File {
    return new File({ url, mediaType });
  }

  static fromBuffer(data: Uint8Array, mediaType: string): File {
    return new File({ data, mediaType });
  }

  static fromGenerated(generated: {
    uint8Array: Uint8Array;
    mediaType: string;
    url?: string;
  }): File {
    return new File({
      data: generated.uint8Array,
      mediaType: generated.mediaType,
      url: generated.url,
    });
  }

  static fromArrayBuffer(buffer: ArrayBuffer, mediaType: string): File {
    return new File({ data: new Uint8Array(buffer), mediaType });
  }

  static async fromBlob(blob: Blob, mediaType?: string): Promise<File> {
    const data = new Uint8Array(await blob.arrayBuffer());
    return new File({ data, mediaType: mediaType ?? blob.type });
  }

  static from(input: {
    uint8Array: Uint8Array;
    mimeType?: string;
    mediaType?: string;
  }): File;
  static from(
    input: string | Uint8Array | ArrayBuffer | Blob,
    mediaType?: string,
  ): File | Promise<File>;
  static from(
    input:
      | string
      | Uint8Array
      | ArrayBuffer
      | Blob
      | { uint8Array: Uint8Array; mimeType?: string; mediaType?: string },
    mediaType?: string,
  ): File | Promise<File> {
    if (typeof input === "object" && input !== null && "uint8Array" in input) {
      const mime =
        input.mimeType ?? input.mediaType ?? "application/octet-stream";
      return File.fromBuffer(input.uint8Array, mime);
    }
    if (typeof input === "string" && /^https?:\/\//.test(input)) {
      return File.fromUrl(input, mediaType);
    }
    if (typeof input === "string") {
      return File.fromPath(input, mediaType);
    }
    if (input instanceof Blob) {
      return File.fromBlob(input, mediaType);
    }
    if (input instanceof ArrayBuffer) {
      return File.fromArrayBuffer(
        input,
        mediaType ?? "application/octet-stream",
      );
    }
    return File.fromBuffer(input, mediaType ?? "application/octet-stream");
  }

  get mediaType(): string {
    return this._mediaType;
  }

  isImage(): boolean {
    return this._mediaType.startsWith("image/");
  }

  isAudio(): boolean {
    return this._mediaType.startsWith("audio/");
  }

  isVideo(): boolean {
    return this._mediaType.startsWith("video/");
  }

  hasUrl(): boolean {
    return this._url !== null;
  }

  async data(): Promise<Uint8Array> {
    if (this._data) return this._data;
    if (this._loader) {
      this._data = await this._loader();
      return this._data;
    }
    if (this._url) {
      const response = await fetch(this._url);
      this._data = new Uint8Array(await response.arrayBuffer());
      return this._data;
    }
    throw new Error("File has no data source");
  }

  async arrayBuffer(): Promise<Uint8Array> {
    return this.data();
  }

  async blob(): Promise<Blob> {
    const data = await this.arrayBuffer();
    return new Blob([data], { type: this._mediaType });
  }

  async upload(storage: StorageProvider): Promise<string> {
    if (this._url) return this._url;
    const data = await this.data();
    const key = `varg/${Date.now()}-${Math.random().toString(36).slice(2)}${this.extensionFromMediaType()}`;
    this._url = await storage.upload(data, key, this._mediaType);
    return this._url;
  }

  async url(uploader?: (blob: Blob) => Promise<string>): Promise<string> {
    if (this._url) return this._url;
    if (uploader) {
      const blob = await this.blob();
      this._url = await uploader(blob);
      return this._url;
    }
    throw new Error(
      "File.url() requires an uploader function or use File.upload(storage) with a StorageProvider",
    );
  }

  async base64(): Promise<string> {
    const data = await this.arrayBuffer();
    let binary = "";
    for (const byte of data) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  async toInput(): Promise<ImageModelV3File> {
    if (this._url) {
      return { type: "url", url: this._url };
    }
    const data = await this.arrayBuffer();
    return { type: "file", mediaType: this._mediaType, data };
  }

  async toTempFile(): Promise<string> {
    const data = await this.data();
    const ext = this.extensionFromMediaType();
    const tmpDir = process.env.TMPDIR ?? "/tmp";
    const filename = `varg-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const path = `${tmpDir}/${filename}`;
    await Bun.write(path, data);
    return path;
  }

  async getPath(): Promise<string> {
    if (this._url) return this._url;
    return this.toTempFile();
  }

  static async toTemp(
    file:
      | { uint8Array: Uint8Array; mimeType?: string; mediaType?: string }
      | File,
  ): Promise<string> {
    if (file instanceof File) {
      return file.toTempFile();
    }
    const f = File.from(file);
    return f.toTempFile();
  }

  private extensionFromMediaType(): string {
    const extMap: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "audio/mpeg": ".mp3",
      "audio/wav": ".wav",
      "audio/mp4": ".m4a",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/quicktime": ".mov",
    };
    return extMap[this._mediaType] ?? "";
  }
}

function inferMediaType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return mimeTypes[ext ?? ""] ?? "application/octet-stream";
}

export function files(...paths: string[]): File[] {
  return paths.map((p) => File.fromPath(p));
}
