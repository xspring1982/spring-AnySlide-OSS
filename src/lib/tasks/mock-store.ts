// 任务的临时内存存储（Sprint 1 没接 DB 之前用）
// 接 Neon 之后整体替换为 sql 查询，调用方 API 不变
//
// 注意：dev server HMR 可能导致 globalThis 被重置，因此用 globalThis 兜住引用，
// 让模块重载时仍指向同一个 Map。

import type { TaskRecord } from "./types";

const GLOBAL_KEY = "__anyslide_task_store__";
type GlobalThisWithStore = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, TaskRecord>;
};

const g = globalThis as GlobalThisWithStore;
if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = new Map<string, TaskRecord>();
}

export const taskStore = g[GLOBAL_KEY]!;

export function listTasksByUser(userId: string): TaskRecord[] {
  return Array.from(taskStore.values())
    .filter((t) => t.userId === userId && !t.deletedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
