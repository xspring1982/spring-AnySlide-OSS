// SPEC §5.2 — 存储抽象层入口
//
// 用法：
//   import { storage } from '@/lib/storage';
//   await storage.put('tasks/abc/cards/01-1.png', buf, { contentType: 'image/png' });
//
// 业务代码统一调 storage.*，底层根据 STORAGE_BACKEND 自动选 local / r2。
// 路径规范见 SPEC §5.2.2。

import { createBackend } from './factory';
import type { StorageBackend } from './types';

export const storage: StorageBackend = createBackend();

export type {
  StorageBackend,
  StorageObject,
  PutOptions,
  ListOptions,
} from './types';
