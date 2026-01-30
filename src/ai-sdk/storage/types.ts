export interface StorageProvider {
  upload(data: Uint8Array, key: string, mediaType: string): Promise<string>;
}
