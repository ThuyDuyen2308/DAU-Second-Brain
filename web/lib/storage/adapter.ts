// web/lib/storage/adapter.ts
import fs from "fs";
import path from "path";

export interface IStorageAdapter {
  save(filename: string, buffer: Buffer, checksum: string): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
  getAbsolutePath(storagePath: string): string;
}

/**
 * LocalStorageAdapter: Luu tru file cuc bo trong thu muc web/uploads/imported
 * Chia nho sub-directory theo 2 ky tu dau cua checksum SHA-256 de chong tran folder.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), "uploads", "imported");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async save(filename: string, buffer: Buffer, checksum: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    const prefix = checksum.slice(0, 2);
    const subDir = path.join(this.baseDir, prefix);

    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }

    const safeName = `${checksum}${ext}`;
    const targetFile = path.join(subDir, safeName);

    await fs.promises.writeFile(targetFile, buffer);
    return path.relative(process.cwd(), targetFile).replace(/\\/g, "/");
  }

  async read(storagePath: string): Promise<Buffer> {
    const absPath = this.getAbsolutePath(storagePath);
    return await fs.promises.readFile(absPath);
  }

  async delete(storagePath: string): Promise<void> {
    const absPath = this.getAbsolutePath(storagePath);
    if (fs.existsSync(absPath)) {
      await fs.promises.unlink(absPath);
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    const absPath = this.getAbsolutePath(storagePath);
    return fs.existsSync(absPath);
  }

  getAbsolutePath(storagePath: string): string {
    if (path.isAbsolute(storagePath)) {
      return storagePath;
    }
    return path.join(process.cwd(), storagePath);
  }
}