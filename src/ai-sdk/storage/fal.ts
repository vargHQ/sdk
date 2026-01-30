import type { StorageProvider } from "./types";

export function falStorage(): StorageProvider {
  return {
    async upload(data: Uint8Array, _key: string, mediaType: string) {
      const { fal } = await import("@fal-ai/client");
      const blob = new Blob([data], { type: mediaType });
      return fal.storage.upload(blob);
    },
  };
}
