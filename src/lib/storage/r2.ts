// SPEC §5.2 — Cloudflare R2 backend（S3-compatible）
// Sprint 1：实现完整 SDK 调用骨架，但 R2 切换是上线前最后一步（§5.2.5）。
// 本地开发请保持 STORAGE_BACKEND=local，R2_* 凭证在 .env.production 配置。

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import type {
  ListOptions,
  PutOptions,
  StorageBackend,
  StorageObject,
} from './types';

const TRASH_PREFIX = '_trash/';

interface R2Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;        // 例：https://<account>.r2.cloudflarestorage.com
}

export class R2Backend implements StorageBackend {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer | Uint8Array | string, opts?: PutOptions): Promise<void> {
    const body =
      typeof data === 'string'
        ? Buffer.from(data, 'utf-8')
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts?.contentType,
        CacheControl: opts?.cacheControl,
      }),
    );
  }

  async putStream(key: string, stream: ReadableStream, opts?: PutOptions): Promise<void> {
    const chunks: Buffer[] = [];
    const reader = stream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    await this.put(key, Buffer.concat(chunks), opts);
  }

  async get(key: string): Promise<Buffer> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!out.Body) throw new Error(`storage: r2 get empty body: ${key}`);
    const stream = out.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }

  async getStream(key: string): Promise<ReadableStream> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!out.Body) throw new Error(`storage: r2 getStream empty body: ${key}`);
    return Readable.toWeb(out.Body as Readable) as ReadableStream;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err: unknown) {
      const code = (err as { $metadata?: { httpStatusCode?: number }; name?: string });
      if (code?.$metadata?.httpStatusCode === 404 || code?.name === 'NotFound') return false;
      throw err;
    }
  }

  async list(prefix: string, opts?: ListOptions): Promise<StorageObject[]> {
    const out = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: opts?.limit ?? 1000,
        ContinuationToken: opts?.cursor,
      }),
    );
    return (out.Contents ?? []).map((o) => ({
      key: o.Key ?? '',
      size: o.Size ?? 0,
      lastModified: o.LastModified ?? new Date(0),
    }));
  }

  async softDelete(key: string): Promise<void> {
    if (key.startsWith(TRASH_PREFIX)) return;
    const trashKey = TRASH_PREFIX + key;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `/${this.bucket}/${encodeURIComponent(key)}`,
        Key: trashKey,
      }),
    );
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async hardDelete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }
}
