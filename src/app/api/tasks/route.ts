// SPEC §2.1 Step 2 — POST /api/tasks 创建任务
//
// 请求体（最小集）：
//   { mode, project_id?, source_text?, source_file_url?, style_id, ratio, generation_mode, template_id? }
//
// 响应：{ taskId, projectId } → 前端 redirect /project/{projectId}
//
// M5+:
//   - 必须登录(Clerk auth),否则 401
//   - project_id 可选:不传则自动创"未命名项目";传则视为追加 batch 到已有 project
//   - 三模块都进 project 容器:cards/image 多 batch 累积,slides 1 deck 1 project

import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@clerk/nextjs/server";
import { makeSlug } from "@/lib/tasks/slug";
import { createTask, updateTaskAnalyzeResult } from "@/lib/tasks/repo";
import { createProject, getProject } from "@/lib/projects/repo";
import { rateLimitWithCleanup } from "@/lib/auth/anti-fraud";
import type { TaskMode, GenerationMode } from "@/lib/tasks/types";
import { detectRequestLocale } from "@/i18n/locale-util";
import { inngest } from "@/inngest/client";

interface CreateTaskBody {
  mode: TaskMode;
  /** M5+:可选 — 不传则自动创新 project,传则追加 batch */
  project_id?: string;
  source_text?: string;
  source_file_url?: string;
  style_id: string;
  ratio: string;
  generation_mode?: GenerationMode;
  template_id?: string;
  /** slides 保真模式:true = 只分页保留原文,不改写内容 */
  preserve_content?: boolean;
  /** image mode 专属（SPEC §4.1 Step 1）— 当前 schema v2 未单列字段,M1 暂忽略 */
  enhance?: boolean;
  count?: number;
}

const VALID_MODES: TaskMode[] = ["cards", "slides", "image"];
// "auto" = 让 AI 决定;具体值由 cards-generate 函数在 analyze 阶段推荐
const VALID_RATIOS = ["auto", "3:4", "4:5", "1:1", "9:16", "16:9", "3:2"];

export async function POST(req: NextRequest) {
  // 2026-05-08 fix:顶层 try/catch 兜底 — 之前任何 unhandled exception 直接穿透到
  // serverless runtime 可能返回 Content-Length: 0 的 empty 500,前端只能看到 "HTTP 500"
  // 无法诊断根因。catch 块返回 JSON body 含 debug message(截 500 字),便于线上排查;
  // 等定位根因后改成只在 NODE_ENV === 'development' 暴露 debug 字段。
  try {
  // 必须登录(M5+:不再 dev fallback)
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = a.userId;

  // 限流:每用户每分钟最多 6 次生成请求(防恶意刷生成烧 token)
  const rl = rateLimitWithCleanup(`tasks:${userId}`, 6, 60_000);
  if (!rl.ok) {
    const retryIn = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return Response.json(
      {
        error: `生成太快了,${retryIn} 秒后重试 — 防机器人刷流量`,
        retryAfter: retryIn,
      },
      { status: 429, headers: { "Retry-After": String(retryIn) } },
    );
  }

  const body = (await req.json()) as CreateTaskBody;

  // 校验
  if (!VALID_MODES.includes(body.mode)) {
    return Response.json({ error: "mode 不合法" }, { status: 400 });
  }
  // style_id / ratio 都允许 "auto" 或不传(让 AI 自决,在 cards-generate 内 fallback)
  const styleId = body.style_id?.trim() || "auto";
  const ratio = body.ratio?.trim() || "auto";
  if (!VALID_RATIOS.includes(ratio)) {
    return Response.json({ error: "ratio 不合法" }, { status: 400 });
  }
  if (!body.source_text && !body.source_file_url && !body.template_id) {
    return Response.json(
      { error: "至少提供 source_text / source_file_url / template_id 中的一个" },
      { status: 400 },
    );
  }
  if (body.mode === "image" && body.count !== undefined) {
    if (![1, 2, 4].includes(body.count)) {
      return Response.json(
        { error: "image count 只支持 1 / 2 / 4" },
        { status: 400 },
      );
    }
  }

  // T2-50:Fail-Early Prompt 文本预审
  // 在 chargeCredits / inngest 入队前,先用 OpenAI Moderation 文本审核(<1s)
  // 命中违规直接 400 返,不创建 task 记录,不扣积分,不烧 gpt-image-2 配额
  if (body.source_text && body.source_text.trim().length > 0) {
    const { checkTextNSFW, nsfwCategoriesToUserMessage } = await import(
      "@/lib/safety/nsfw"
    );
    const textCheck = await checkTextNSFW(body.source_text);
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

  // M5+:project 处理
  // - 传了 project_id → 校验存在 + 归属当前用户 + mode 一致
  // - 没传 → 自动创新 project,标题用 source_text 截前 40 字
  let projectId: string;
  if (body.project_id) {
    const proj = await getProject(body.project_id);
    if (!proj) {
      return Response.json({ error: "项目不存在" }, { status: 404 });
    }
    if (proj.userId !== userId) {
      return Response.json({ error: "无权访问该项目" }, { status: 403 });
    }
    if (proj.mode !== body.mode) {
      return Response.json(
        { error: `该项目是 ${proj.mode} 模式,无法追加 ${body.mode}` },
        { status: 400 },
      );
    }
    projectId = proj.id;
  } else {
    const titleSeed = body.source_text?.slice(0, 40)?.trim() || "未命名项目";
    const newProj = await createProject({
      userId,
      mode: body.mode,
      title: titleSeed,
    });
    projectId = newProj.id;
  }

  const id = nanoid(12);
  const titleSeed = body.source_text?.slice(0, 40) || "新任务";

  // M9 多语言:从 cookie / Accept-Language 自动检测当前用户的 UI 语言
  // 写入 task.locale,后续 inngest 生成时按这个语言调 LLM
  const locale = detectRequestLocale(req);

  await createTask({
    id,
    userId,
    projectId,
    mode: body.mode,
    title: titleSeed,
    slug: makeSlug(titleSeed),
    sourceText: body.source_text ?? null,
    sourceFileUrl: body.source_file_url ?? null,
    styleId,
    ratio,
    generationMode: body.generation_mode ?? "batch",
    templateId: body.template_id ?? null,
    preserveContent: body.preserve_content ?? false,
    locale,
  });

  // image mode 的 count + enhance 没有专门字段,先放进 analyze_result.meta(image-generate 会读)
  if (body.mode === "image" && (body.count !== undefined || body.enhance !== undefined)) {
    await updateTaskAnalyzeResult(
      id,
      { count: body.count ?? 1, enhance: body.enhance ?? true },
      "",
    );
  }

  // 触发 Inngest 异步生成
  if (body.mode === "cards") {
    await inngest.send({
      name: "task/cards.generate",
      data: { taskId: id, userId },
    });
  } else if (body.mode === "slides") {
    await inngest.send({
      name: "task/slides.generate",
      data: { taskId: id, userId },
    });
  } else if (body.mode === "image") {
    await inngest.send({
      name: "task/image.generate",
      data: { taskId: id, userId },
    });
  }

  return Response.json({ taskId: id, projectId });
  } catch (err) {
    console.error("[POST /api/tasks] unhandled:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: "创建任务失败,服务暂时不可用,请稍后重试",
        code: "INTERNAL_ERROR",
        // 暂时全环境暴露截断 debug message 便于诊断;根因定位后改成 dev-only
        debug: message.slice(0, 500),
      },
      { status: 500 },
    );
  }
}
