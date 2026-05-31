// PR15c — PATCH /api/tasks/[taskId]/outline
//
// 用户编辑 outline(改 title / body / bullets / 删页 / 加页)后,前端调这个
// endpoint 把整份新 outline 持久化到 task.analyze_result。
//
// inngest L1 templated path 的 confirm 之后会**从 DB 重读 analyze_result**(不是
// in-memory analyze 输出),所以编辑会生效。
//
// 请求:
//   PATCH /api/tasks/[taskId]/outline { outline: SlidesAnalyzeOutput }
//
// 响应:{ ok: true } / 错误 JSON
//
// 校验:
//   - 用户必须登录 + 是 task 主人
//   - task.status === "confirming"(只能在等待确认时编辑)
//   - outline.outline.cover / closing / sections 结构合法

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { getTask, updateTaskAnalyzeResult } from "@/lib/tasks/repo";
import type { SlidesAnalyzeOutput } from "@/lib/slides/agents";

export const dynamic = "force-dynamic";

interface Body {
  outline: SlidesAnalyzeOutput;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const outline = body.outline;
  if (!outline || typeof outline !== "object") {
    return Response.json({ error: "缺少 outline" }, { status: 400 });
  }
  if (
    !outline.outline ||
    !outline.outline.cover ||
    !outline.outline.closing ||
    !Array.isArray(outline.outline.sections)
  ) {
    return Response.json(
      { error: "outline 结构不合法(缺 cover/closing/sections)" },
      { status: 400 },
    );
  }

  const task = await getTask(taskId);
  if (!task) return Response.json({ error: "任务不存在" }, { status: 404 });
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }
  if (task.status !== "confirming") {
    return Response.json(
      {
        error: `任务状态 ${task.status},仅 confirming 可编辑 outline`,
      },
      { status: 409 },
    );
  }

  // 重新计算 index(用户加/删 slide 后 index 可能错乱)
  // 顺序:cover → agenda? → sections.flatMap([divider?, ...slides]) → closing
  let runningIndex = 1;
  outline.outline.cover.index = runningIndex++;
  if (outline.outline.agenda) {
    outline.outline.agenda.index = runningIndex++;
  }
  for (const sec of outline.outline.sections) {
    if (sec.divider) sec.divider.index = runningIndex++;
    if (Array.isArray(sec.slides)) {
      for (const s of sec.slides) {
        s.index = runningIndex++;
      }
    }
  }
  outline.outline.closing.index = runningIndex++;
  outline.recommended_count = runningIndex - 1;

  await updateTaskAnalyzeResult(
    taskId,
    outline,
    task.textModelUsed ?? "user-edited",
  );

  return Response.json({ ok: true, recommended_count: outline.recommended_count });
}
