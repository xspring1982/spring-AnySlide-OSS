// 文稿 gate 定稿:用户优化完文稿后回复「定稿」→ 触发 task/slides.source-confirmed,
// slides-generate 的 waitForEvent 收到后继续直接生成幻灯片(智能模式)。

import { NextRequest } from "next/server";
import { getTask } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;

  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }
  if (task.status !== "confirming_source") {
    return Response.json(
      { error: `任务状态 ${task.status},仅 confirming_source 可定稿` },
      { status: 409 },
    );
  }

  await inngest.send({
    name: "task/slides.source-confirmed",
    data: { taskId },
  });

  return Response.json({ ok: true });
}
