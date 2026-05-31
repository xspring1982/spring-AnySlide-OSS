// SPEC §5.1.3 — GET /api/tasks/[id] 拉任务详情 + 已生成的图片
//
// 资源级越权防护：task.userId === auth.userId
// M5+:必须登录,移除 dev fallback

import { NextRequest } from "next/server";
import { getTask, listTaskImageFiles, softDeleteTask, getLatestVersion } from "@/lib/tasks/repo";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/require";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  const files = await listTaskImageFiles(taskId);
  const latestVersion = await getLatestVersion(taskId);
  const canvasLayout = latestVersion?.canvasLayout ?? null;

  return Response.json({
    id: task.id,
    projectId: task.projectId,
    mode: task.mode,
    title: task.title,
    slug: task.slug,
    status: task.status,
    agentPhase: task.agentPhase,
    styleId: task.styleId,
    ratio: task.ratio,
    generationMode: task.generationMode,
    templateId: task.templateId,
    enhance: task.enhance,
    imageCount: task.imageCount,
    sourceText: task.sourceText,
    analyzeResult: task.analyzeResult,
    clarifyAnswers: task.clarifyAnswers,
    currentVersionNo: task.currentVersionNo,
    totalCreditsCharged: task.totalCreditsCharged,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    images: files.map((f) => ({
      pageNo: f.pageNo,
      pageVersion: f.pageVersion,
      role: f.role,
      url: f.storageUrl,
    })),
    canvasLayout,
  });
}

/** PATCH — 任务字段切换(generation_mode / styleId / ratio),仅在 generating 之前允许 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }
  // 已开始生成 / 已完成 / 失败 → 字段锁定
  if (
    task.status === "generating" ||
    task.status === "done" ||
    task.status === "failed"
  ) {
    return Response.json(
      { error: `任务已开始生成,无法修改;切换请新建项目` },
      { status: 409 },
    );
  }

  let body: { generation_mode?: string; style_id?: string; ratio?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体解析失败" }, { status: 400 });
  }

  if (body.generation_mode && !["batch", "one-by-one"].includes(body.generation_mode)) {
    return Response.json({ error: "generation_mode 不合法" }, { status: 400 });
  }

  // 只更新提供的字段
  const setParts: string[] = [];
  const updates: { generation_mode?: string; style_id?: string; ratio?: string } = {};
  if (body.generation_mode) updates.generation_mode = body.generation_mode;
  if (body.style_id) updates.style_id = body.style_id;
  if (body.ratio) updates.ratio = body.ratio;
  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: true, noChange: true });
  }

  if (updates.generation_mode) setParts.push(`generation_mode='${updates.generation_mode}'`);
  if (updates.style_id) setParts.push(`style_id='${updates.style_id.replace(/'/g, "''")}'`);
  if (updates.ratio) setParts.push(`ratio='${updates.ratio.replace(/'/g, "''")}'`);

  // 用模板字符串拼安全:已校验过 generation_mode,style_id 用 escape;走 sql.query 而非 tagged template
  await sql.query(
    `UPDATE tasks SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = $1`,
    [taskId],
  );

  return Response.json({ ok: true });
}

/** SPEC §6.6 — 软删任务(30 天可恢复) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { error, userId } = await requireUser();
  if (error) return error;

  const { taskId } = await params;
  const task = await getTask(taskId);
  if (!task) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }
  if (task.userId !== userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  await softDeleteTask(taskId);
  return Response.json({ ok: true });
}
