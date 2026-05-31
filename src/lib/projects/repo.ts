// SPEC §2.9.x — projects repo (M5)

import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import type { TaskMode } from "@/lib/tasks/types";
import type { CanvasState, ProjectRecord, ProjectListItem } from "./types";

interface ProjectRow {
  id: string;
  user_id: string;
  mode: string;
  title: string;
  canvas_state: CanvasState | null;
  cover_image_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(r: ProjectRow): ProjectRecord {
  return {
    id: r.id,
    userId: r.user_id,
    mode: r.mode as TaskMode,
    title: r.title,
    canvasState: r.canvas_state,
    coverImageUrl: r.cover_image_url,
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export async function createProject(args: {
  userId: string;
  mode: TaskMode;
  title?: string;
}): Promise<ProjectRecord> {
  const id = `p_${nanoid(12)}`;
  const title = args.title?.trim() || "未命名项目";
  const rows = (await sql`
    INSERT INTO projects (id, user_id, mode, title, created_at, updated_at)
    VALUES (${id}, ${args.userId}, ${args.mode}, ${title}, NOW(), NOW())
    RETURNING *
  `) as unknown as ProjectRow[];
  return rowToRecord(rows[0]);
}

export async function getProject(
  projectId: string,
): Promise<ProjectRecord | null> {
  const rows = (await sql`
    SELECT * FROM projects WHERE id = ${projectId} AND deleted_at IS NULL LIMIT 1
  `) as unknown as ProjectRow[];
  return rows[0] ? rowToRecord(rows[0]) : null;
}

export async function listProjects(
  userId: string,
  limit = 50,
): Promise<ProjectListItem[]> {
  // 子查询 fc:每个 project 的首张图(用于 cover_image_url 为空时实时兜底)
  const rows = (await sql`
    SELECT
      p.*,
      COALESCE(tc.task_count, 0)::int  AS task_count,
      COALESCE(ic.image_count, 0)::int AS image_count,
      fc.first_image_url               AS first_image_url
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(*)::int AS task_count
      FROM tasks WHERE deleted_at IS NULL GROUP BY project_id
    ) tc ON tc.project_id = p.id
    LEFT JOIN (
      SELECT t.project_id, COUNT(*)::int AS image_count
      FROM tasks t
      JOIN task_files f ON f.task_id = t.id
      WHERE t.deleted_at IS NULL AND f.type = 'image' AND f.deleted_at IS NULL
      GROUP BY t.project_id
    ) ic ON ic.project_id = p.id
    LEFT JOIN (
      SELECT DISTINCT ON (t.project_id)
        t.project_id, f.storage_url AS first_image_url
      FROM tasks t
      JOIN task_files f ON f.task_id = t.id
      WHERE t.deleted_at IS NULL AND f.type = 'image' AND f.deleted_at IS NULL
      ORDER BY t.project_id, t.created_at, f.created_at
    ) fc ON fc.project_id = p.id
    WHERE p.user_id = ${userId} AND p.deleted_at IS NULL
    ORDER BY p.updated_at DESC
    LIMIT ${limit}
  `) as unknown as Array<
    ProjectRow & {
      task_count: number;
      image_count: number;
      first_image_url: string | null;
    }
  >;
  return rows.map((r) => ({
    ...rowToRecord(r),
    coverImageUrl: r.cover_image_url ?? r.first_image_url ?? null,
    taskCount: r.task_count,
    imageCount: r.image_count,
  }));
}

export async function updateProjectTitle(
  projectId: string,
  title: string,
): Promise<void> {
  const t = title.trim() || "未命名项目";
  await sql`
    UPDATE projects SET title = ${t}, updated_at = NOW() WHERE id = ${projectId}
  `;
}

export async function updateCanvasState(
  projectId: string,
  state: CanvasState,
): Promise<void> {
  await sql`
    UPDATE projects SET canvas_state = ${JSON.stringify(state)}::jsonb,
                        updated_at = NOW()
    WHERE id = ${projectId}
  `;
}

export async function setCoverImage(
  projectId: string,
  url: string,
): Promise<void> {
  await sql`
    UPDATE projects
    SET cover_image_url = ${url}, updated_at = NOW()
    WHERE id = ${projectId} AND cover_image_url IS NULL
  `;
}

export async function softDeleteProject(projectId: string): Promise<void> {
  await sql`
    UPDATE projects SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${projectId}
  `;
  // 级联软删名下 tasks(后续 cron 跟着清 task_files / R2)
  await sql`
    UPDATE tasks SET deleted_at = NOW(), updated_at = NOW()
    WHERE project_id = ${projectId} AND deleted_at IS NULL
  `;
}

/** 任务首张图生成时回填封面;幂等(只在 cover 为空时填) */
export async function maybeBackfillCover(taskId: string): Promise<void> {
  await sql`
    UPDATE projects p
    SET cover_image_url = sub.url, updated_at = NOW()
    FROM (
      SELECT t.project_id, f.storage_url AS url
      FROM tasks t
      JOIN task_files f ON f.task_id = t.id
      WHERE t.id = ${taskId} AND f.type = 'image' AND f.deleted_at IS NULL
      ORDER BY f.created_at LIMIT 1
    ) sub
    WHERE p.id = sub.project_id AND p.cover_image_url IS NULL
  `;
}
