// SPEC §2.1 Step 3 — /task/[taskId]
// 三模块共用 URL，按 task.mode 分流（详 §5.1.2）
// M1：cards 模式 UI 骨架；slides / image mode 留 TODO

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { TaskWorkspace } from "@/components/task/TaskWorkspace";
import type { TaskRecord } from "@/lib/tasks/types";

interface TaskApiResponse
  extends Omit<TaskRecord, "createdAt" | "updatedAt" | "deletedAt"> {
  createdAt: string;
  updatedAt: string;
  images?: Array<{
    pageNo: number;
    pageVersion: number;
    role: string | null;
    url: string;
  }>;
}

async function fetchTask(taskId: string): Promise<TaskApiResponse | null> {
  // server component → 内部 fetch 自家 API（绝对 URL 必须带 host）
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : "";
  const res = await fetch(`${base}/api/tasks/${taskId}`, {
    cache: "no-store",
    // 透传 cookie（auth 用）
    headers: { cookie: h.get("cookie") ?? "" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchTask failed: HTTP ${res.status}`);
  return (await res.json()) as TaskApiResponse;
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const task = await fetchTask(taskId);
  if (!task) notFound();

  // SPEC §5.1.2 — 按 mode 分流，M1 三种 mode 都先走 TaskWorkspace 骨架
  return <TaskWorkspace task={task} />;
}
