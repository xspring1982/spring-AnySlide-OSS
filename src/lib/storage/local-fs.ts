// SPEC §5.2 — 本地文件系统 backend（Sprint 1 默认实现）
// 文件落盘到 LOCAL_STORAGE_DIR（默认 ./tmp），目录结构与 R2 key 完全对齐。

import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type {
  ListOptions,
  PutOptions,
  StorageBackend,
  StorageObject,
} from './types';

const TRASH_PREFIX = '_trash/';

export class LocalFsBackend implements StorageBackend {
  private readonly rootDir: string;

  constructor(opts: { rootDir: string }) {
    this.rootDir = path.resolve(opts.rootDir);
  }

  // -------- 路径解析 --------
  private resolveKey(key: string): string {
    if (key.startsWith('/') || key.includes('..')) {
      throw new Error(`storage: 非法 key（必须相对路径，禁止 ..）: ${key}`);
    }
    return path.join(this.rootDir, key);
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  // -------- 写入 --------
  async put(key: string, data: Buffer | Uint8Array | string, _opts?: PutOptions): Promise<void> {
    const filePath = this.resolveKey(key);
    await this.ensureDir(filePath);
    const buf =
      typeof data === 'string'
        ? Buffer.from(data, 'utf-8')
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data);
    await fs.writeFile(filePath, buf);
  }

  async putStream(key: string, stream: ReadableStream, _opts?: PutOptions): Promise<void> {
    const chunks: Buffer[] = [];
    const reader = stream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    await this.put(key, Buffer.concat(chunks));
  }

  // -------- 读取 --------
  async get(key: string): Promise<Buffer> {
    const filePath = this.resolveKey(key);
    return fs.readFile(filePath);
  }

  async getStream(key: string): Promise<ReadableStream> {
    const filePath = this.resolveKey(key);
    const nodeStream = createReadStream(filePath);
    return Readable.toWeb(nodeStream) as ReadableStream;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string, opts?: ListOptions): Promise<StorageObject[]> {
    const limit = opts?.limit ?? 1000;
    const baseDir = this.resolveKey(prefix);
    const results: StorageObject[] = [];

    async function walk(dir: string, root: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw err;
      }
      for (const entry of entries) {
        if (results.length >= limit) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, root);
        } else if (entry.isFile()) {
          const stat = await fs.stat(full);
          results.push({
            key: path.relative(root, full).split(path.sep).join('/'),
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }
    }

    await walk(baseDir, this.rootDir);
    return results;
  }

  // -------- 删除 --------
  async softDelete(key: string): Promise<void> {
    if (key.startsWith(TRASH_PREFIX)) return; // 已在 trash
    const src = this.resolveKey(key);
    const dst = this.resolveKey(TRASH_PREFIX + key);
    try {
      await this.ensureDir(dst);
      await fs.rename(src, dst);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  async hardDelete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  // -------- 签名 URL --------
  // 本地开发不签名，直接返回 dev 路由可访问的相对路径。
  // 生产 R2Backend 用 SDK 真签名。
  async signedUrl(key: string, _ttlSeconds: number): Promise<string> {
    return `/api/storage/${encodeURI(key)}`;
  }
}
