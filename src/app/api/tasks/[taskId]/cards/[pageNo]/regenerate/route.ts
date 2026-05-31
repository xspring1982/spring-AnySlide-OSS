// SPEC §2.7.2 — 单张重生 API
//
// POST /api/tasks/[taskId]/cards/[pageNo]/regenerate
//   2026-05-28:cards 重新上线为图文笔记(HTML/PNG),暂不走旧 AI 生图重生链路。

import { NextRequest } from "next/server";
import { getTask } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ taskId: string; pageNo: string }>;
  },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId, pageNo: pageNoStr } = await params;
  const pageNo = parseInt(pageNoStr, 10);
  if (!Number.isFinite(pageNo) || pageNo < 1) {
    return Response.json({ error: "pageNo 不合法" }, { status: 400 });
  }

  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  if (task.mode !== "cards") {
    return Response.json({ error: "非 cards 模式" }, { status: 400 });
  }
  if (task.status !== "done") {
    return Response.json(
      { error: `任务状态 ${task.status},仅 done 后可单张重生` },
      { status: 409 },
    );
  }

  return Response.json(
    { error: "图文笔记暂不支持单张重生,请新建一组笔记" },
    { status: 410 },
  );
}
