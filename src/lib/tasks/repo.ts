// SPEC §2.9 任务持久化层(Neon)
//
// 替代 mock-store.ts 的内存实现。约定:
//   - 行 → TaskRecord 的转换在 rowToTask() 一处完成,不在 caller 散
//   - 写入用 sql 模板字符串自动参数化(不拼字符串)
//   - status / phase 状态机推进直接在这里加 helper(updateStatus / updatePhase)
//
// M1 阶段 task_versions / task_files 也在这一份文件,M3+ 拆 repo 时再分。

import { sql } from "@/lib/db";
import type { Locale } from "@/i18n/routing";
import { ALL_LOCALES } from "@/i18n/locale-util";
import type {
  AnalyzeResult,
  ClarifyAnswers,
  GenerationMode,
  TaskMode,
  TaskRecord,
  TaskStatus,
  AgentPhase,
} from "./types";

function asLocale(v: string | null | undefined): Locale {
  if (v && (ALL_LOCALES as readonly string[]).includes(v)) return v as Locale;
  return "zh"; // schema 默认值,与 m9 migration 对齐
}

// ─────────────────────── tasks ───────────────────────

interface TaskRow {
  id: string;
  user_id: string;
  project_id: string;
  mode: string;
  title: string;
  slug: string;
  status: string;
  agent_phase: string | null;
  source_text: string | null;
  source_file_url: string | null;
  style_id: string;
  ratio: string;
  generation_mode: string;
  template_id: string | null;
  preserve_content: boolean;
  locale: string | null;
  analyze_result: AnalyzeResult | null;
  clarify_answers: ClarifyAnswers | null;
  research_data: unknown;
  current_version_no: number;
  text_model_used: string | null;
  image_model_used: string | null;
  total_credits_charged: number;
  total_credits_refunded: number;
  error_message: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // image mode 字段尚未在 schema v2 中(SPEC §4.5 把 image 字段塞 metadata jsonb)
  // M1 暂时把 enhance / image_count 留在 analyze_result.metadata 里或单独字段
}

function rowToTask(r: TaskRow): TaskRecord {
  return {
    id: r.id,
    userId: r.user_id,
    mode: r.mode as TaskMode,
    title: r.title,
    slug: r.slug,
    status: r.status as TaskStatus,
    projectId: r.project_id,
    agentPhase: r.agent_phase as AgentPhase | null,
    sourceText: r.source_text,
    sourceFileUrl: r.source_file_url,
    styleId: r.style_id,
    ratio: r.ratio,
    generationMode: r.generation_mode as GenerationMode,
    templateId: r.template_id,
    preserveContent: r.preserve_content ?? false,
    locale: asLocale(r.locale),
    enhance: null, // image mode 字段(M1 不在 schema 里;需要时加 jsonb 列)
    imageCount: null,
    analyzeResult: r.analyze_result,
    clarifyAnswers: r.clarify_answers,
    researchData: r.research_data,
    currentVersionNo: r.current_version_no,
    textModelUsed: r.text_model_used,
    imageModelUsed: r.image_model_used,
    totalCreditsCharged: r.total_credits_charged,
    totalCreditsRefunded: r.total_credits_refunded,
    errorMessage: r.error_message,
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export interface CreateTaskInput {
  id: string; // nanoid,caller 生成
  userId: string;
  /** M5+:必填 — 任意 task 都归属一个 project */
  projectId: string;
  mode: TaskMode;
  title: string;
  slug: string;
  sourceText: string | null;
  sourceFileUrl: string | null;
  styleId: string;
  ratio: string;
  generationMode: GenerationMode;
  templateId: string | null;
  /** slides 保真模式:只分页保留原文,不传默认 false */
  preserveContent?: boolean;
  /** M9 多语言:任务语言;不传走 schema 默认值 'zh'(兼容旧 caller)*/
  locale?: Locale;
}

/** 插入新 task(默认 status='created',phase=null) */
export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const locale = input.locale ?? "zh";
  const rows = (await sql`
    INSERT INTO tasks (
      id, user_id, project_id, mode, title, slug, status, agent_phase,
      source_text, source_file_url, style_id, ratio, generation_mode, template_id,
      preserve_content,
      locale,
      current_version_no, total_credits_charged, total_credits_refunded
    ) VALUES (
      ${input.id}, ${input.userId}, ${input.projectId}, ${input.mode}, ${input.title}, ${input.slug},
      'created', NULL,
      ${input.sourceText}, ${input.sourceFileUrl}, ${input.styleId}, ${input.ratio},
      ${input.generationMode}, ${input.templateId},
      ${input.preserveContent ?? false},
      ${locale},
      1, 0, 0
    )
    RETURNING *
  `) as TaskRow[];
  return rowToTask(rows[0]);
}

export async function getTask(id: string): Promise<TaskRecord | null> {
  const rows = (await sql`
    SELECT * FROM tasks WHERE id = ${id} AND deleted_at IS NULL
  `) as TaskRow[];
  return rows[0] ? rowToTask(rows[0]) : null;
}

/**
 * 更新任务状态(可选附带 errorMessage,T2-51)
 *
 * - errorMessage 仅在 status==='failed' 时有意义,但 schema 不强制(允许任意状态写入)
 * - 不传 errorMessage 时不动 error_message 列(保留之前的值)
 * - 显式传 null 也不会清空(避免误清);如要清空需用专用 helper
 */
export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  phase: AgentPhase | null = null,
  errorMessage?: string,
): Promise<void> {
  if (errorMessage !== undefined) {
    await sql`
      UPDATE tasks
      SET status = ${status},
          agent_phase = ${phase},
          error_message = ${errorMessage},
          updated_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE tasks
      SET status = ${status}, agent_phase = ${phase}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

/** 更新任务的 source_text(保真模式「优化文稿」后写回最新文稿) */
export async function updateTaskSourceText(
  id: string,
  sourceText: string,
): Promise<void> {
  await sql`
    UPDATE tasks SET source_text = ${sourceText}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateTaskAnalyzeResult(
  id: string,
  analyzeResult: AnalyzeResult | unknown,
  textModelUsed: string,
): Promise<void> {
  await sql`
    UPDATE tasks
    SET analyze_result = ${JSON.stringify(analyzeResult)}::jsonb,
        text_model_used = ${textModelUsed},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function setImageModelUsed(
  id: string,
  imageModelUsed: string,
): Promise<void> {
  await sql`
    UPDATE tasks
    SET image_model_used = ${imageModelUsed}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * M2.7:LLM 推荐了风格 / 比例后,把 task 的 styleId / ratio 从 'auto' 改成实际值,
 * 这样后续 GET /api/tasks/[id] 返回的就是真实的风格 + ratio,UI 也能正确显示。
 */
export async function updateTaskEffectiveStyleRatio(
  id: string,
  styleId: string,
  ratio: string,
): Promise<void> {
  await sql`
    UPDATE tasks
    SET style_id = ${styleId}, ratio = ${ratio}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/** SPEC §6.6:软删任务,30 天后 cron 物理清理。可逆 */
export async function softDeleteTask(id: string): Promise<void> {
  await sql`
    UPDATE tasks
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `;
}

// ─────────────────────── task_versions ───────────────────────

export async function appendTaskVersion(input: {
  id: string; // nanoid
  taskId: string;
  versionNo: number;
  outline: unknown;
}): Promise<void> {
  await sql`
    INSERT INTO task_versions (id, task_id, version_no, outline)
    VALUES (${input.id}, ${input.taskId}, ${input.versionNo}, ${JSON.stringify(input.outline)}::jsonb)
    ON CONFLICT (task_id, version_no) DO UPDATE
      SET outline = EXCLUDED.outline
  `;
}

export async function getLatestVersion(
  taskId: string,
): Promise<{
  id: string;
  versionNo: number;
  outline: unknown;
  canvasLayout: unknown;
} | null> {
  const rows = (await sql`
    SELECT id, version_no, outline, canvas_layout
    FROM task_versions
    WHERE task_id = ${taskId}
    ORDER BY version_no DESC
    LIMIT 1
  `) as Array<{
    id: string;
    version_no: number;
    outline: unknown;
    canvas_layout: unknown;
  }>;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    versionNo: rows[0].version_no,
    outline: rows[0].outline,
    canvasLayout: rows[0].canvas_layout,
  };
}

/**
 * M2.6 — 写最新 task_version 的 canvas_layout(用户拖拽 / 缩放后)
 */
export async function updateLatestCanvasLayout(
  taskId: string,
  layout: unknown,
): Promise<void> {
  await sql`
    UPDATE task_versions
    SET canvas_layout = ${JSON.stringify(layout)}::jsonb
    WHERE task_id = ${taskId}
      AND version_no = (
        SELECT MAX(version_no) FROM task_versions WHERE task_id = ${taskId}
      )
  `;
}

// ─────────────────────── task_files ───────────────────────

export interface TaskFileRow {
  id: string;
  taskId: string;
  versionId: string | null;
  type: "source" | "prompt" | "image" | "ref" | "export";
  pageNo: number | null;
  pageVersion: number | null;
  role: "cover" | "content" | "closing" | null;
  filename: string;
  storageUrl: string;
  sizeBytes: number | null;
  mimeType: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export async function appendTaskFile(input: {
  id: string;
  taskId: string;
  versionId?: string | null;
  type: TaskFileRow["type"];
  pageNo?: number | null;
  pageVersion?: number | null;
  role?: TaskFileRow["role"];
  filename: string;
  storageUrl: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  expiresAt?: Date | null;
}): Promise<void> {
  await sql`
    INSERT INTO task_files (
      id, task_id, version_id, type, page_no, page_version, role,
      filename, storage_url, size_bytes, mime_type, expires_at
    ) VALUES (
      ${input.id}, ${input.taskId}, ${input.versionId ?? null}, ${input.type},
      ${input.pageNo ?? null}, ${input.pageVersion ?? null}, ${input.role ?? null},
      ${input.filename}, ${input.storageUrl},
      ${input.sizeBytes ?? null}, ${input.mimeType ?? null},
      ${input.expiresAt ? input.expiresAt.toISOString() : null}
    )
  `;

  // M5+:首张图自动回填 project.cover_image_url(幂等,只在 cover 为空时填)
  // 仅当存的是 image 类型 + page_no=1 时尝试回填(避免每张都查)
  if (input.type === "image" && input.pageNo === 1) {
    try {
      await sql`
        UPDATE projects p
        SET cover_image_url = ${input.storageUrl}, updated_at = NOW()
        FROM tasks t
        WHERE t.id = ${input.taskId}
          AND p.id = t.project_id
          AND p.cover_image_url IS NULL
      `;
    } catch (err) {
      console.warn("[appendTaskFile] cover backfill failed (non-fatal):", err);
    }
  }
}

export async function listTaskImageFiles(
  taskId: string,
): Promise<
  Array<{
    pageNo: number;
    pageVersion: number;
    role: string | null;
    storageUrl: string;
    createdAt: Date;
  }>
> {
  const rows = (await sql`
    SELECT page_no, page_version, role, storage_url, created_at
    FROM task_files
    WHERE task_id = ${taskId} AND type = 'image' AND deleted_at IS NULL
    ORDER BY page_no ASC, page_version DESC
  `) as Array<{
    page_no: number;
    page_version: number;
    role: string | null;
    storage_url: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    pageNo: r.page_no,
    pageVersion: r.page_version,
    role: r.role,
    storageUrl: r.storage_url,
    createdAt: new Date(r.created_at),
  }));
}

// ─────────────────────── users(M1 dev fixture) ───────────────────────

/**
 * 确保 dev 匿名用户存在(M1 阶段 Clerk 还没接,所有任务挂这个用户)。
 * M3 接 Clerk 后由 webhook 写真用户,这个 fixture 删除即可。
 */
export async function ensureDevUser(userId: string): Promise<void> {
  // 60 = SIGNUP_BONUS_AMOUNT;为避免循环依赖直接写字面量,真用户走 Clerk webhook 那条路
  await sql`
    INSERT INTO users (id, email, credit_balance, plan)
    VALUES (${userId}, ${userId + "@dev.local"}, 60, 'free')
    ON CONFLICT (id) DO NOTHING
  `;
}

