export interface CacheItem {
  id: string;
  filename: string;
  type: "image" | "video" | "unknown";
  size: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface CacheEntry {
  value: unknown;
  expires: number;
}

export interface ImageData {
  uint8ArrayData?: {
    __type: "Uint8Array";
    data: string;
  };
  base64?: string;
  url?: string;
}

export interface VideoData {
  _data?: {
    __type: "Uint8Array";
    data: string;
  };
  uint8ArrayData?: {
    __type: "Uint8Array";
    data: string;
  };
  base64?: string;
  url?: string;
}

export interface RenderRequest {
  code: string;
  cacheDir?: string;
}

export interface RenderProgress {
  step: "parsing" | "rendering" | "complete" | "error";
  progress: number;
  message: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
}

export interface HistoryItem {
  id: string;
  code: string;
  videoUrl: string;
  thumbnail?: string;
  createdAt: Date;
}
