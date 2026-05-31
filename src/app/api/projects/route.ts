// SPEC §2.9.x — /api/projects
// GET  → 列出当前用户的所有 project(M5)
// POST → 创建一个 project(指定 mode + 可选 title)

import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createProject, listProjects } from "@/lib/projects/repo";
import { rateLimitWithCleanup } from "@/lib/auth/anti-fraud";
import type { TaskMode } from "@/lib/tasks/types";

const VALID_MODES: TaskMode[] = ["cards", "image", "slides"];

export async function GET() {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  const projects = await listProjects(a.userId, 100);
  return Response.json({
    projects: projects.map((p) => ({
      id: p.id,
      mode: p.mode,
      title: p.title,
      coverImageUrl: p.coverImageUrl,
      taskCount: p.taskCount,
      imageCount: p.imageCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }
  // 限流:每用户每分钟最多 12 次新建 project(防刷空 project)
  const rl = rateLimitWithCleanup(`projects:${a.userId}`, 12, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "新建项目太频繁,稍后再试" },
      { status: 429 },
    );
  }
  let body: { mode?: TaskMode; title?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体解析失败" }, { status: 400 });
  }
  if (!body.mode || !VALID_MODES.includes(body.mode)) {
    return Response.json(
      { error: `mode 必须是 ${VALID_MODES.join(" / ")}` },
      { status: 400 },
    );
  }
  const project = await createProject({
    userId: a.userId,
    mode: body.mode,
    title: body.title,
  });
  return Response.json(
    {
      id: project.id,
      mode: project.mode,
      title: project.title,
      createdAt: project.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
