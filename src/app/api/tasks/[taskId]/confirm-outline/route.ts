// SPEC §2.1 Step 7 — 大纲确认介入点
//
// POST /api/tasks/[taskId]/confirm-outline { action: "start" | "redo" }
// 触发 Inngest event `task/cards.outline-confirmed`,cards-generate 函数 waitForEvent 接收

import { NextRequest } from "next/server";
import { getTask } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";

interface Body {
  action: "start" | "redo";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (body.action !== "start" && body.action !== "redo") {
    return Response.json(
      { error: 'action 必须是 "start" 或 "redo"' },
      { status: 400 },
    );
  }

  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  if (task.status !== "confirming") {
    return Response.json(
      { error: `任务状态 ${task.status},仅 confirming 可确认` },
      { status: 409 },
    );
  }

  await inngest.send({
    name: "task/cards.outline-confirmed",
    data: { taskId, action: body.action },
  });

  return Response.json({ ok: true });
}
