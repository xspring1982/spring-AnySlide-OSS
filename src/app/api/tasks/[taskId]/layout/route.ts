// SPEC §2.8.7 — canvas_layout 持久化
//
// PATCH /api/tasks/[taskId]/layout { positions, sizes }
// 写最新 task_versions.canvas_layout

import { NextRequest } from "next/server";
import { getTask, updateLatestCanvasLayout } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { positions?: Record<string, { x: number; y: number }>; sizes?: Record<string, { w: number; h: number }> }
    | null;
  if (!body) {
    return Response.json({ error: "请求体不合法" }, { status: 400 });
  }

  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  await updateLatestCanvasLayout(taskId, {
    positions: body.positions ?? {},
    sizes: body.sizes ?? {},
  });

  return Response.json({ ok: true });
}
