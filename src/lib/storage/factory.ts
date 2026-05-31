// SPEC §5.2.1 — backend 工厂
// 根据 STORAGE_BACKEND 环境变量决定 local / r2。
// 默认 local（本地开发）；生产 .env.production 设 r2。

import { LocalFsBackend } from './local-fs';
import { R2Backend } from './r2';
import type { StorageBackend, StorageBackendName } from './types';

export function createBackend(): StorageBackend {
  const name = (process.env.STORAGE_BACKEND ?? 'local') as StorageBackendName;

  if (name === 'r2') {
    const bucket = process.env.R2_BUCKET;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;

    if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error(
        'storage: STORAGE_BACKEND=r2 但缺少 R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT',
      );
    }

    return new R2Backend({ bucket, accessKeyId, secretAccessKey, endpoint });
  }

  return new LocalFsBackend({
    rootDir: process.env.LOCAL_STORAGE_DIR ?? './tmp',
  });
}
