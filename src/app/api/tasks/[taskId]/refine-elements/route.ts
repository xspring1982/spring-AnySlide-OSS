// Phase 6 PR40 — 元素级标注修改 endpoint
//
// POST /api/tasks/[taskId]/refine-elements
//   body: { annotations: [{ pageNo, selector, currentText, instruction, sectionRole? }, ...] }
//
// 流程(同步,因为单元素 LLM 调用快 < 5 秒,5 个标注 < 30 秒):
//   1. 鉴权 + 校验 task 归属 + status === 'done' + L1 templated
//   2. 加载当前 deck.html(最高 pageVersion)
//   3. cheerio 解析 → 对每个 annotation:
//      - 用 selector 找元素
//      - 调 refineElementText LLM 拿 newText
//      - 替换 innerText
//   4. 写新 task_file (pageVersion + 1)
//   5. 返回 { ok, pageVersion, modelUsed, applied: N, skipped: [] }
//   6. SSE 自动推前端(因为新 task_file → SlideDeckView 自动 reload)
//
// 计费:0.5 积分/标注(比 refine-slide 单页改的 1 积分便宜)
//
// 跟 refine-slide / refine-deck 的关系:
//   - refine-slide: 单页改(整 section,LLM 改 innerText 自由度大)
//   - refine-deck:  整 deck 对话改(LLM 决定改哪几页)
//   - refine-elements (本): 多元素批量改(用户在 deck 上点元素 + 输指令)
//     最精细级别,LLM 自由度最低(只改 selector 内的纯文本)

import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import * as cheerio from "cheerio";
import { requireUser } from "@/lib/auth/require";
import {
  getTask,
  appendTaskFile,
  listTaskImageFiles,
} from "@/lib/tasks/repo";
import { chargeCredits, InsufficientCreditsError } from "@/lib/credits";
import { refineElementText } from "@/lib/slides/agents/element-refine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CREDITS_PER_ANNOTATION = 0.5; // 0.5 积分/标注(但 chargeCredits 要 integer,所以下面 ceil)

interface Annotation {
  pageNo: number;
  selector: string;
  currentText: string;
  instruction: string;
  sectionRole?: string;
}

interface Body {
  annotations: Annotation[];
}

interface SkippedItem {
  selector: string;
  reason: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const annotations = Array.isArray(body.annotations) ? body.annotations : [];
  if (annotations.length === 0) {
    return Response.json({ error: "annotations 数组为空" }, { status: 400 });
  }
  if (annotations.length > 20) {
    return Response.json(
      { error: "单次最多 20 个标注(避免 LLM 串行调用过久)" },
      { status: 400 },
    );
  }

  // 校验每个 annotation 字段
  for (const a of annotations) {
    if (
      typeof a.pageNo !== "number" ||
      typeof a.selector !== "string" ||
      typeof a.currentText !== "string" ||
      typeof a.instruction !== "string" ||
      a.instruction.trim().length === 0
    ) {
      return Response.json(
        { error: "annotation 字段缺失:需要 { pageNo, selector, currentText, instruction }" },
        { status: 400 },
      );
    }
  }

  // 校验 task
  const task = await getTask(taskId);
  if (!task) return Response.json({ error: "task 不存在" }, { status: 404 });
  if (task.userId !== userId) {
    return Response.json({ error: "无权操作该任务" }, { status: 403 });
  }
  if (task.mode !== "slides") {
    return Response.json(
      { error: "仅 slides 模式支持元素级修改" },
      { status: 400 },
    );
  }
  if (!task.templateId) {
    return Response.json(
      { error: "非 L1 模板填充任务,不支持元素级修改" },
      { status: 400 },
    );
  }

  // 扣积分(ceil 到整数)
  const chargeAmount = Math.ceil(annotations.length * CREDITS_PER_ANNOTATION);
  try {
    await chargeCredits({
      txId: nanoid(12),
      userId,
      amount: chargeAmount,
      reason: "generate",
      taskId,
      modelUsed: "element-refine",
      metadata: {
        kind: "refine_elements",
        annotation_count: annotations.length,
      },
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return Response.json(
        {
          error: `积分不足,需 ${e.required},余额 ${e.balance}`,
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 },
      );
    }
    throw e;
  }

  // 加载当前 deck.html
  const files = await listTaskImageFiles(taskId);
  const deckFiles = files.filter(
    (f) => f.pageNo === 1 && f.storageUrl.startsWith("data:text/html"),
  );
  if (deckFiles.length === 0) {
    return Response.json(
      { error: "找不到 deck 文件" },
      { status: 400 },
    );
  }
  deckFiles.sort((a, b) => b.pageVersion - a.pageVersion);
  const latest = deckFiles[0];
  const m = latest.storageUrl.match(/^data:text\/html;base64,(.+)$/);
  if (!m) {
    return Response.json({ error: "deck 文件格式异常" }, { status: 500 });
  }
  const deckHtml = Buffer.from(m[1], "base64").toString("utf-8");

  // cheerio 加载
  const $ = cheerio.load(deckHtml);
  const skipped: SkippedItem[] = [];
  let appliedCount = 0;
  let modelUsedLast = "";

  // 串行处理每个 annotation(避免并发 LLM 调用打满 rate limit)
  for (const ann of annotations) {
    const $el = $(ann.selector);
    if ($el.length === 0) {
      skipped.push({
        selector: ann.selector,
        reason: "selector 找不到元素(可能 deck 已改过结构)",
      });
      continue;
    }
    if ($el.length > 1) {
      skipped.push({
        selector: ann.selector,
        reason: `selector 匹配 ${$el.length} 个元素,跳过(歧义)`,
      });
      continue;
    }

    // 抓周围上下文(同 section 的其他 text)
    const $section = $el.closest("section");
    const surroundingText = $section
      .find("h1, h2, h3, p, li")
      .toArray()
      .map((el) => $(el).text().trim())
      .filter((t) => t.length > 0 && t !== ann.currentText)
      .join(" · ")
      .slice(0, 500);

    try {
      const result = await refineElementText({
        currentText: ann.currentText,
        instruction: ann.instruction,
        context: {
          pageRole: ann.sectionRole,
          surroundingText,
          elementTag: $el.prop("tagName")?.toLowerCase(),
        },
        locale: task.locale,
      });
      $el.text(result.newText);
      appliedCount++;
      modelUsedLast = result.modelUsed;
    } catch (e) {
      skipped.push({
        selector: ann.selector,
        reason: e instanceof Error ? e.message : "LLM 改写失败",
      });
    }
  }

  if (appliedCount === 0) {
    return Response.json(
      {
        ok: false,
        applied: 0,
        skipped,
        error: "所有标注都失败了,没有改动应用",
      },
      { status: 500 },
    );
  }

  // 写新 task_file
  const newHtml = $.html() ?? deckHtml;
  const newDataUrl = `data:text/html;base64,${Buffer.from(newHtml, "utf-8").toString("base64")}`;
  const newPageVersion = latest.pageVersion + 1;
  await appendTaskFile({
    id: nanoid(12),
    taskId,
    type: "image",
    pageNo: 1,
    pageVersion: newPageVersion,
    role: "cover",
    filename: `deck-elt-v${newPageVersion}.html`,
    storageUrl: newDataUrl,
    mimeType: "text/html",
  });

  return Response.json({
    ok: true,
    applied: appliedCount,
    skipped,
    pageVersion: newPageVersion,
    modelUsed: modelUsedLast,
  });
}
