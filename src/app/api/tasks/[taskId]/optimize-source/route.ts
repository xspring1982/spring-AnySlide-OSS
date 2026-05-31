// 保真模式「优化文稿」:用户给一条优化要求 → LLM 在保留事实前提下改写 source_text →
// 写回 DB + 返回新文稿(用户可继续优化或点确认定稿)。仅在 confirming_source 阶段可用。

import { NextRequest } from "next/server";
import { getTask, updateTaskSourceText } from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";
import { ai } from "@/lib/ai";

export const dynamic = "force-dynamic";

interface Body {
  instruction?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const instruction = body.instruction?.trim();
  if (!instruction) {
    return Response.json({ error: "请填写优化要求" }, { status: 400 });
  }

  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }
  if (task.status !== "confirming_source") {
    return Response.json(
      { error: `任务状态 ${task.status},仅 confirming_source 可优化文稿` },
      { status: 409 },
    );
  }
  if (!task.sourceText) {
    return Response.json({ error: "无文稿可优化" }, { status: 400 });
  }

  const system = [
    "你是文稿优化助手。用户会给一段文稿和一条优化要求。",
    "请按要求优化这段文稿,但必须遵守:",
    "1. 保留原文的事实、数据、人名、专有名词,绝不编造。",
    "2. 只做用户要求的优化(例如调整结构 / 精简 / 扩写 / 改语气),不要擅自删改无关内容。",
    "3. 保持原文语言,不要翻译。",
    "4. 直接输出优化后的【完整文稿纯文本】,不要任何解释,不要 markdown 围栏。",
  ].join("\n");
  const user = [
    "# 原文稿",
    task.sourceText,
    "",
    "# 优化要求",
    instruction,
    "",
    "现在输出优化后的完整文稿(纯文本):",
  ].join("\n");

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 8000,
    temperature: 0.4,
    cacheSystem: false,
  });
  const optimized = completion.text.trim();
  if (!optimized) {
    return Response.json({ error: "优化失败,请重试" }, { status: 502 });
  }

  await updateTaskSourceText(taskId, optimized);
  return Response.json({ ok: true, sourceText: optimized });
}
