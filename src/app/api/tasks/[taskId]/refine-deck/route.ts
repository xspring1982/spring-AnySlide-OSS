// PR27 — 整 deck Refine endpoint
//
// POST /api/tasks/[taskId]/refine-deck { feedback: string }
//
// 用户在已 done 的 task 页输入修改意见时调用。流程:
//   1. 校验任务归属 + status === 'done' + 是 L1 模板填充任务
//   2. NSFW 文本预审(复用 checkTextNSFW)
//   3. 发 inngest event `task/slides.refine` → 进 slides-refine 函数异步处理
//   4. 202 立即返回(实际生成在 inngest 里跑,前端通过 SSE 监听状态变化)
//
// 不在这里扣积分 — 积分由 slides-refine inngest function 内部 step.run 原子扣,
// 跟 slides-generate 保持一致(失败 onFailure 退款的语义清晰)。

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { getTask } from "@/lib/tasks/repo";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FEEDBACK_LEN = 1000;

interface Body {
  feedback: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const feedback = body.feedback?.trim();
  if (!feedback) {
    return Response.json({ error: "缺少 feedback" }, { status: 400 });
  }
  if (feedback.length > MAX_FEEDBACK_LEN) {
    return Response.json(
      { error: `feedback 过长(最长 ${MAX_FEEDBACK_LEN} 字)` },
      { status: 400 },
    );
  }

  const task = await getTask(taskId);
  if (!task) return Response.json({ error: "task 不存在" }, { status: 404 });
  if (task.userId !== userId) {
    return Response.json({ error: "无权操作该任务" }, { status: 403 });
  }
  if (task.mode !== "slides") {
    return Response.json(
      { error: "仅 slides 模式支持 refine" },
      { status: 400 },
    );
  }
  if (!task.templateId) {
    return Response.json(
      { error: "L2 / 无模板任务不支持 refine,请重新生成" },
      { status: 400 },
    );
  }
  if (task.status !== "done") {
    return Response.json(
      { error: `任务当前 status=${task.status},需 done 之后才能 refine` },
      { status: 400 },
    );
  }

  // NSFW 文本预审(与 /api/tasks/route.ts 同 pattern)
  try {
    const { checkTextNSFW, nsfwCategoriesToUserMessage } = await import(
      "@/lib/safety/nsfw"
    );
    const textCheck = await checkTextNSFW(feedback);
    if (!textCheck.safe) {
      return Response.json(
        {
          error: nsfwCategoriesToUserMessage(textCheck.flaggedCategories, "text"),
          code: "NSFW_TEXT_BLOCKED",
        },
        { status: 400 },
      );
    }
  } catch {
    // NSFW 服务挂了不卡用户:静默放过,inngest 阶段还会再有兜底
  }

  await inngest.send({
    name: "task/slides.refine",
    data: { taskId, userId, feedback },
  });

  return Response.json({ ok: true, taskId }, { status: 202 });
}
