// POST /api/tasks/[taskId]/cancel — 用户主动取消任务
//
// 取消窗口判定(2026-05-11 PR29 收紧:出图阶段不再支持软停):
//   ✅ 真停(思考阶段,API 未发):
//      - mode = cards / slides 且 phase ∈ { null, analyze, clarify, outline, confirm }
//      - 设 status='cancelled' → Inngest mark-generating 前 short-circuit
//      - 思考阶段未 chargeCredits,**不需退款**
//   ⛔ 出图阶段拒绝(API 已发,无法停):
//      - mode = cards / slides 且 phase ∈ { cover, batch }
//      - mode = image(单图直出)
//      - 返回 409 + cantCancelAtOutput=true,**不改 task.status**
//      - 前端拿到后 alert "正在生成,请耐心等待",任务继续显示 generating
//      - 用户决策(2026-05-11):跟 Lovart 等大站统一,出图阶段一律不能停
//        (API 已花钱 + 软停的 UX 反而让用户疑惑"到底停了没")
//   ⛔ 已结束(幂等):
//      - status = done / failed / cancelled
//
// 返回:
//   200 { ok: true, canCancel: true }                真停成功
//   409 { ok: false, cantCancelAtOutput: true }      出图阶段拒绝(task.status 保持 generating)
//   200 { ok: true, alreadyEnded: true, status: ... } 幂等

import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTask, updateTaskStatus } from "@/lib/tasks/repo";
import type { AgentPhase } from "@/lib/tasks/types";

export const runtime = "nodejs";

/** Phase A:可取消(思考类) */
const CANCELLABLE_PHASES: ReadonlyArray<AgentPhase | null> = [
  null,
  "analyze",
  "clarify",
  "outline",
  "confirm",
];

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const { taskId } = await ctx.params;
  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== a.userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  // 已结束:幂等 200
  if (task.status === "done" || task.status === "failed" || task.status === "cancelled") {
    return Response.json({ ok: true, alreadyEnded: true, status: task.status });
  }

  // 2026-05-11 PR29:出图阶段(包括 image 单图直出 / cards|slides 的 cover|batch)拒绝 cancel
  // task.status 保持不变,前端会读 cantCancelAtOutput=true 显示 "正在生成,请耐心等待"
  const inImagePhase = task.mode === "image";
  const inOutputPhase =
    task.agentPhase !== null && !CANCELLABLE_PHASES.includes(task.agentPhase);
  if (inImagePhase || inOutputPhase) {
    return Response.json(
      {
        ok: false,
        cantCancelAtOutput: true,
        currentStatus: task.status,
        currentPhase: task.agentPhase,
      },
      { status: 409 },
    );
  }

  // 思考阶段真停:Inngest mark-generating 前 short-circuit,API 不会发
  await updateTaskStatus(taskId, "cancelled", task.agentPhase);
  return Response.json({ ok: true, canCancel: true });
}
