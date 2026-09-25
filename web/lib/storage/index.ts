// web/lib/storage/index.ts
import { IStorageAdapter, LocalStorageAdapter } from "./adapter";

let storageAdapterInstance: IStorageAdapter | null = null;

export function getStorageAdapter(): IStorageAdapter {
  if (!storageAdapterInstance) {
    const adapterType = process.env.STORAGE_ADAPTER || "local";
    if (adapterType === "local") {
      storageAdapterInstance = new LocalStorageAdapter();
    } else {
      // Cho tuong lai khi tich hop S3/Cloudflare R2
      console.warn(`[Storage] Storage adapter "${adapterType}" chua ho tro, fallback sang LocalStorageAdapter`);
      storageAdapterInstance = new LocalStorageAdapter();
    }
  }
  return storageAdapterInstance;
}