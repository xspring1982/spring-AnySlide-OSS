// SPEC §2.6.2 — 大纲 refine(restructure 模式)
//
// POST /api/tasks/[taskId]/refine { instruction: string }
// 同步调 DeepSeek refine outline,~30s 内返回新 outline
// SSE stream 会自动推 outline 更新事件,前端 chat 列大纲气泡自动刷新

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import {
  getTask,
  updateTaskAnalyzeResult,
  appendTaskVersion,
} from "@/lib/tasks/repo";
import { requireUser } from "@/lib/auth/require";
import { sql } from "@/lib/db";
import { ai } from "@/lib/ai";
import {
  buildRefineMessages,
  parseRefineOutput,
  type AnalyzeOutput,
  type RefineMode,
} from "@/lib/cards/agents";
import { getCardStyle } from "@/lib/cards/styles";
import type { CardStyleId, RatioId } from "@/lib/cards/styles/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Body {
  instruction: string;
  mode?: RefineMode; // 默认 restructure
  targetCardIndex?: number;
}

const CARDS_RATIOS: RatioId[] = ["3:4", "4:5", "1:1", "9:16", "16:9", "3:2"];
function asRatio(s: string): RatioId {
  if ((CARDS_RATIOS as string[]).includes(s)) return s as RatioId;
  return "3:4";
}
function asStyleId(s: string): CardStyleId {
  try {
    getCardStyle(s as CardStyleId);
    return s as CardStyleId;
  } catch {
    return "xiaohongshu_fresh";
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const instruction = body.instruction?.trim();
  if (!instruction) {
    return Response.json({ error: "缺少 instruction" }, { status: 400 });
  }
  const mode: RefineMode = body.mode ?? "restructure";

  // T2-50:Fail-Early Prompt 文本预审 — refine 也走文本审核(秒拦违规指令)
  {
    const { checkTextNSFW, nsfwCategoriesToUserMessage } = await import(
      "@/lib/safety/nsfw"
    );
    const textCheck = await checkTextNSFW(instruction);
    if (!textCheck.safe) {
      return Response.json(
        {
          error: nsfwCategoriesToUserMessage(textCheck.flaggedCategories, "text"),
          code: "NSFW_TEXT_BLOCKED",
        },
        { status: 400 },
      );
    }
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
  const currentOutline = task.analyzeResult as AnalyzeOutput | null;
  if (!currentOutline) {
    return Response.json({ error: "当前任务无 outline 可 refine" }, { status: 400 });
  }

  const styleId = asStyleId(task.styleId);
  const ratio = asRatio(task.ratio);
  const style = getCardStyle(styleId);

  const messages = buildRefineMessages({
    currentOutline,
    refineMode: mode,
    userInstruction: instruction,
    targetCardIndex: body.targetCardIndex,
    style,
    ratio,
  });

  const completion = await ai.text.complete({
    system: messages.system,
    user: messages.user,
    tier: "default",
    maxTokens: 8192,
    temperature: 0.6,
    cacheSystem: true,
  });

  const parsed = parseRefineOutput(completion.text, {
    mode,
    targetCardIndex: body.targetCardIndex,
  });
  if (!parsed.ok) {
    // eslint-disable-next-line no-console
    console.error(
      "[refine] parse failed; raw text:",
      completion.text.slice(0, 1500),
    );
    return Response.json(
      { error: `refine 输出解析失败: ${parsed.error.kind}` },
      { status: 500 },
    );
  }

  // restructure 模式直接拿到新 outline;regenerate_card 只更新一张
  let newOutline: AnalyzeOutput;
  if (parsed.output.mode === "restructure") {
    newOutline = parsed.output.outline;
  } else {
    // regenerate_card:在现有 outline 中替换该张
    const refinedCard = parsed.output.card;
    newOutline = {
      ...currentOutline,
      cards: currentOutline.cards.map((c) =>
        c.index === refinedCard.index ? refinedCard : c,
      ),
    };
  }

  // 持久化
  const newVersionNo = task.currentVersionNo + 1;
  await updateTaskAnalyzeResult(taskId, newOutline, completion.model);
  await appendTaskVersion({
    id: nanoid(12),
    taskId,
    versionNo: newVersionNo,
    outline: newOutline,
  });
  await sql`UPDATE tasks SET current_version_no = ${newVersionNo}, updated_at = NOW() WHERE id = ${taskId}`;

  return Response.json({
    ok: true,
    versionNo: newVersionNo,
    outline: newOutline,
  });
}
