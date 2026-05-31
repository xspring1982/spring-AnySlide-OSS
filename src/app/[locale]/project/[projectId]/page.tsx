// /project/[id] — Project workspace(M5 Day 2)
// 三种状态:
//   未登录 → /login
//   project 存在 + 无 task → 渲染 NewTaskWorkspace(传 projectId,提交时挂到此 project)
//   project 存在 + 至少 1 task → 渲染 ProjectWorkspace(聚合所有 batch 图,bottom chat 输入触发追加)

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProject } from "@/lib/projects/repo";
import { sql } from "@/lib/db";
import { NewTaskWorkspace } from "@/components/task/NewTaskWorkspace";
import { ProjectWorkspace } from "@/components/project/ProjectWorkspace";
import type { TaskRecord } from "@/lib/tasks/types";

interface ProjectTaskRow {
  id: string;
  status: string;
  agent_phase: string | null;
  title: string;
  ratio: string;
  created_at: string;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const a = await auth();
  if (!a.userId) {
    redirect(`/login?redirect_url=/project/${projectId}`);
  }

  const project = await getProject(projectId);
  if (!project) {
    redirect("/assets");
  }
  if (project.userId !== a.userId) {
    redirect("/assets");
  }

  // 拉所有 task(按时间正序)+ 所有图
  const tasks = (await sql`
    SELECT id, status, agent_phase, title, ratio, created_at
    FROM tasks
    WHERE project_id = ${projectId} AND deleted_at IS NULL
    ORDER BY created_at ASC
  `) as unknown as ProjectTaskRow[];

  // 空 project → 复用 NewTaskWorkspace(带 projectId,提交时挂到此 project)
  if (tasks.length === 0) {
    return (
      <NewTaskWorkspace projectId={projectId} projectMode={project.mode} />
    );
  }

  // 拉所有图(跨 task 聚合)
  const imagesRaw = (await sql`
    SELECT t.id AS task_id, f.page_no, f.page_version, f.role, f.storage_url
    FROM tasks t
    JOIN task_files f ON f.task_id = t.id
    WHERE t.project_id = ${projectId}
      AND t.deleted_at IS NULL
      AND f.type = 'image'
      AND f.deleted_at IS NULL
    ORDER BY t.created_at ASC, f.page_no ASC, f.page_version DESC
  `) as unknown as Array<{
    task_id: string;
    page_no: number;
    page_version: number;
    role: string | null;
    storage_url: string;
  }>;

  // 同 page 取最高 version
  const seen = new Set<string>();
  const images = imagesRaw
    .filter((i) => {
      const key = `${i.task_id}-${i.page_no}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((i) => ({
      taskId: i.task_id,
      pageNo: i.page_no,
      pageVersion: i.page_version,
      role: i.role,
      url: i.storage_url,
    }));

  // 拿最新 task(用于显示当前 chat 列状态)
  const latestTaskRow = tasks[tasks.length - 1];
  const latestTaskFull = (await sql`
    SELECT * FROM tasks WHERE id = ${latestTaskRow.id} LIMIT 1
  `) as unknown as Array<TaskRecord & {
    project_id: string;
    source_text: string | null;
    source_file_url: string | null;
    style_id: string;
    generation_mode: string;
    template_id: string | null;
    analyze_result: unknown;
    clarify_answers: unknown;
    research_data: unknown;
    current_version_no: number;
    text_model_used: string | null;
    image_model_used: string | null;
    total_credits_charged: number;
    total_credits_refunded: number;
    error_message: string | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
    agent_phase: string | null;
  }>;

  return (
    <ProjectWorkspace
      project={{
        id: project.id,
        mode: project.mode,
        title: project.title,
        canvasState: project.canvasState,
      }}
      tasks={tasks.map((t) => ({
        id: t.id,
        status: t.status,
        agentPhase: t.agent_phase,
        title: t.title,
        ratio: t.ratio,
        createdAt: t.created_at,
      }))}
      latestTaskId={latestTaskRow.id}
      latestTaskRaw={latestTaskFull[0] ?? null}
      images={images}
    />
  );
}
