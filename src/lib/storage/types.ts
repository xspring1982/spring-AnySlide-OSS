// SPEC §5.2.1 — storage 接口类型定义
// 业务代码不直接调 fs / R2 SDK，统一通过 StorageBackend。

export interface PutOptions {
  contentType?: string;
  expiresAt?: Date;          // Free 用户 7 天过期
  cacheControl?: string;     // 例：'public, max-age=31536000'（模板预览图）
}

export interface ListOptions {
  limit?: number;            // 单次返回上限
  cursor?: string;           // 分页游标
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface StorageBackend {
  // — 写入
  put(key: string, data: Buffer | Uint8Array | string, opts?: PutOptions): Promise<void>;
  putStream(key: string, stream: ReadableStream, opts?: PutOptions): Promise<void>;

  // — 读取
  get(key: string): Promise<Buffer>;
  getStream(key: string): Promise<ReadableStream>;
  exists(key: string): Promise<boolean>;
  list(prefix: string, opts?: ListOptions): Promise<StorageObject[]>;

  // — 删除
  softDelete(key: string): Promise<void>;   // 移到 _trash/，30 天后 cron 物理删
  hardDelete(key: string): Promise<void>;   // 立即物理删（仅 cron 用）

  // — 签名 URL（前端访问）
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

export type StorageBackendName = 'local' | 'r2';
