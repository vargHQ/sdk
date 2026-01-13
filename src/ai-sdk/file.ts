import type { ImageModelV3File } from "@ai-sdk/provider";

export class File {
  private _data: Uint8Array | null = null;
  private _url: string | null = null;
  private _mediaType: string;
  private _loader: (() => Promise<Uint8Array>) | null = null;

  private constructor(
    options:
      | { data: Uint8Array; mediaType: string }
      | { url: string; mediaType?: string }
      | { loader: () => Promise<Uint8Array>; mediaType: string },
  ) {
    if ("data" in options) {
      this._data = options.data;
      this._mediaType = options.mediaType;
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
  }): File {
    return new File({
      data: generated.uint8Array,
      mediaType: generated.mediaType,
    });
  }

  static fromArrayBuffer(buffer: ArrayBuffer, mediaType: string): File {
    return new File({ data: new Uint8Array(buffer), mediaType });
  }

  static async fromBlob(blob: Blob, mediaType?: string): Promise<File> {
    const data = new Uint8Array(await blob.arrayBuffer());
    return new File({ data, mediaType: mediaType ?? blob.type });
  }

  static async from(
    input: string | Uint8Array | ArrayBuffer | Blob,
    mediaType?: string,
  ): Promise<File> {
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

  async arrayBuffer(): Promise<Uint8Array> {
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

  async blob(): Promise<Blob> {
    const data = await this.arrayBuffer();
    return new Blob([data], { type: this._mediaType });
  }

  async url(uploader?: (blob: Blob) => Promise<string>): Promise<string> {
    if (this._url && !this._data && !this._loader) {
      return this._url;
    }
    const blob = await this.blob();
    if (uploader) return uploader(blob);
    try {
      const { fal } = await import("@fal-ai/client");
      return fal.storage.upload(blob);
    } catch {
      throw new Error("No uploader provided and @fal-ai/client not available.");
    }
  }

  async base64(): Promise<string> {
    const data = await this.arrayBuffer();
    let binary = "";
    for (let i = 0; i < data.byteLength; i++) {
      binary += String.fromCharCode(data[i]!);
    }
    return btoa(binary);
  }

  async toInput(): Promise<ImageModelV3File> {
    if (this._url && !this._data && !this._loader) {
      return { type: "url", url: this._url };
    }
    const data = await this.arrayBuffer();
    return { type: "file", mediaType: this._mediaType, data };
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

export async function toInputs(files: File[]): Promise<ImageModelV3File[]> {
  return Promise.all(files.map((f) => f.toInput()));
}

export function convertToInput(generated: {
  uint8Array: Uint8Array;
  mediaType: string;
}): ImageModelV3File {
  return {
    type: "file",
    mediaType: generated.mediaType,
    data: generated.uint8Array,
  };
}
