// PR15b — L1 模板填充模式的「单页修改」endpoint
//
// POST /api/tasks/[taskId]/refine-slide { pageNo: number, instruction: string }
//
// 流程:
//   1. 拿 task 的当前 deck.html(L1 templated 模式存为 1 个 task_file pageNo=1)
//   2. 调 refineL1Section 让 LLM 重写第 N 个 section
//   3. 替换原 deck.html 的对应 section,写新 task_file(pageVersion +1)
//   4. 同时通过 SSE 推流前端,让 SlideDeckView 自动 reload deck

import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth/require";
import {
  getTask,
  appendTaskFile,
  listTaskImageFiles,
} from "@/lib/tasks/repo";
import { refineL1Section } from "@/inngest/functions/slides-template-fill";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Body {
  pageNo: number;
  instruction: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const pageNo = typeof body.pageNo === "number" ? body.pageNo : 0;
  const instruction = body.instruction?.trim();
  if (!instruction) {
    return Response.json({ error: "缺少 instruction" }, { status: 400 });
  }
  if (pageNo < 1) {
    return Response.json({ error: "pageNo 必须 ≥ 1" }, { status: 400 });
  }

  // 校验 task 归属 + 状态
  const task = await getTask(taskId);
  if (!task) return Response.json({ error: "task 不存在" }, { status: 404 });
  if (task.userId !== userId) {
    return Response.json({ error: "无权操作该任务" }, { status: 403 });
  }
  if (task.mode !== "slides") {
    return Response.json(
      { error: "仅 slides 模式支持单页修改" },
      { status: 400 },
    );
  }
  if (!task.templateId) {
    return Response.json(
      { error: "该任务没有关联模板,不支持模板单页修改" },
      { status: 400 },
    );
  }

  // 找当前 deck task_file(L1 模板填充模式存 pageNo=1 的 data:text/html)
  const files = await listTaskImageFiles(taskId);
  const deckFiles = files.filter(
    (f) => f.pageNo === 1 && f.storageUrl.startsWith("data:text/html"),
  );
  if (deckFiles.length === 0) {
    return Response.json(
      { error: "找不到 deck 文件,该任务可能不是模板填充模式或未生成" },
      { status: 400 },
    );
  }
  // 拿最新 pageVersion 的
  deckFiles.sort((a, b) => b.pageVersion - a.pageVersion);
  const latest = deckFiles[0];

  // 解 base64 出 HTML
  const m = latest.storageUrl.match(/^data:text\/html;base64,(.+)$/);
  if (!m) {
    return Response.json({ error: "deck 文件格式异常" }, { status: 500 });
  }
  let deckHtml = "";
  try {
    deckHtml = Buffer.from(m[1], "base64").toString("utf-8");
  } catch (e) {
    return Response.json(
      {
        error: "解码 deck 失败",
        debug: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  // 调 LLM 重写指定 section
  let result: { html: string; modelUsed: string };
  try {
    result = await refineL1Section({
      deckHtml,
      pageNo,
      instruction,
      locale: task.locale,
    });
  } catch (e) {
    return Response.json(
      {
        error: "单页修改失败",
        debug: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  // 写新 task_file(pageVersion + 1),覆盖旧 deck
  const newDataUrl = `data:text/html;base64,${Buffer.from(result.html, "utf-8").toString("base64")}`;
  const newPageVersion = latest.pageVersion + 1;
  await appendTaskFile({
    id: nanoid(12),
    taskId,
    type: "image",
    pageNo: 1,
    pageVersion: newPageVersion,
    role: "cover",
    filename: `deck-v${newPageVersion}.html`,
    storageUrl: newDataUrl,
    mimeType: "text/html",
  });

  return Response.json({
    ok: true,
    pageNo,
    pageVersion: newPageVersion,
    modelUsed: result.modelUsed,
  });
}
