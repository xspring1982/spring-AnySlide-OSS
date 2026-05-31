// SPEC §2.9.x — /api/projects/:id
// GET    → 获取 project 详情(含 canvas_state)+ 名下 tasks 列表
// PATCH  → 改 title / 改 canvas_state
// DELETE → 软删

import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getProject,
  softDeleteProject,
  updateCanvasState,
  updateProjectTitle,
} from "@/lib/projects/repo";
import { sql } from "@/lib/db";

interface ProjectTaskRow {
  id: string;
  status: string;
  agent_phase: string | null;
  title: string;
  ratio: string;
  image_count: number | null;
  created_at: string;
}

async function listProjectTasks(projectId: string) {
  return (await sql`
    SELECT id, status, agent_phase, title, ratio, image_count, created_at
    FROM tasks
    WHERE project_id = ${projectId} AND deleted_at IS NULL
    ORDER BY created_at ASC
  `) as unknown as ProjectTaskRow[];
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const { projectId } = await ctx.params;
  const p = await getProject(projectId);
  if (!p) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }
  if (p.userId !== a.userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }
  const tasks = await listProjectTasks(projectId);
  return Response.json({
    id: p.id,
    mode: p.mode,
    title: p.title,
    canvasState: p.canvasState,
    coverImageUrl: p.coverImageUrl,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    tasks: tasks.map((t) => ({
      id: t.id,
      status: t.status,
      agentPhase: t.agent_phase,
      title: t.title,
      ratio: t.ratio,
      imageCount: t.image_count,
      createdAt: t.created_at,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const { projectId } = await ctx.params;
  const p = await getProject(projectId);
  if (!p) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }
  if (p.userId !== a.userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }

  let body: { title?: string; canvasState?: unknown; mode?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体解析失败" }, { status: 400 });
  }
  if (typeof body.title === "string") {
    await updateProjectTitle(projectId, body.title);
  }
  if (body.canvasState && typeof body.canvasState === "object") {
    await updateCanvasState(
      projectId,
      body.canvasState as Parameters<typeof updateCanvasState>[1],
    );
  }
  // mode 切换:仅当 project 没 task 时允许(出图后锁定)
  if (body.mode && ["cards", "image", "slides"].includes(body.mode)) {
    const taskCountRows = (await sql`
      SELECT COUNT(*)::int AS cnt FROM tasks
      WHERE project_id = ${projectId} AND deleted_at IS NULL
    `) as unknown as Array<{ cnt: number }>;
    if (taskCountRows[0]?.cnt > 0) {
      return Response.json(
        { error: "已生成内容,mode 已锁定;新 mode 请新建项目" },
        { status: 409 },
      );
    }
    await sql`
      UPDATE projects SET mode = ${body.mode}, updated_at = NOW()
      WHERE id = ${projectId}
    `;
  }
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const { projectId } = await ctx.params;
  const p = await getProject(projectId);
  if (!p) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }
  if (p.userId !== a.userId) {
    return Response.json({ error: "无权访问" }, { status: 403 });
  }
  await softDeleteProject(projectId);
  return Response.json({ ok: true });
}
