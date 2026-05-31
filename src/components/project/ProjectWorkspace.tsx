// /project/[id] 工作区(M5 Day 2)
// 三列布局:Sidebar + Chat 列 + 画布
// 跟 TaskWorkspace 区别:
//   - 画布聚合 project 名下所有 task 的图(multi-batch)
//   - 底部输入触发"追加 batch"(POST /api/tasks 带 project_id),不是新建 project
//   - chat 列显示最新 task 的进度 + 项目历史(每个 task 一条折叠条目)
// slides project:专属 4 列布局(SlideDeckView + 缩略列)

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, Send, Trash2, Pencil, Check, X } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TaskCanvas } from "@/components/task/TaskCanvas";
import { SlideDeckView } from "@/components/task/SlideDeckView";
import { TaskChatColumn } from "@/components/task/TaskChatColumn";
import { useTaskStream } from "@/components/task/useTaskStream";
import type { TaskMode } from "@/lib/tasks/types";

type CreationMode = "AI 图文卡片" | "AI 幻灯片" | "AI 图片";
const MODE_LABEL: Record<TaskMode, CreationMode> = {
  cards: "AI 图文卡片",
  slides: "AI 幻灯片",
  image: "AI 图片",
};

interface ProjectImage {
  taskId: string;
  pageNo: number;
  pageVersion: number;
  role: string | null;
  url: string;
}

interface ProjectTaskBrief {
  id: string;
  status: string;
  agentPhase: string | null;
  title: string;
  ratio: string;
  createdAt: string;
}

interface ProjectInfo {
  id: string;
  mode: TaskMode;
  title: string;
  canvasState: unknown;
}

interface Props {
  project: ProjectInfo;
  tasks: ProjectTaskBrief[];
  latestTaskId: string;
  latestTaskRaw: unknown;
  images: ProjectImage[];
}

export function ProjectWorkspace({
  project,
  tasks,
  latestTaskId,
  latestTaskRaw,
  images,
}: Props) {
  const router = useRouter();
  // 2026-05-09 PR10:task 类页面默认收起 sidebar 给主区(幻灯片预览/画布)更多空间
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  // 追加 batch:同 project 内输入新 prompt 创新 task
  const [appendOpen, setAppendOpen] = useState(false);
  const [appendText, setAppendText] = useState("");
  const [appending, setAppending] = useState(false);
  // Rename 项目标题
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  async function saveTitle() {
    const t = titleDraft.trim();
    if (!t || t === project.title) {
      setEditingTitle(false);
      setTitleDraft(project.title);
      return;
    }
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      setEditingTitle(false);
      router.refresh();
    } catch (err) {
      console.error("[rename]", err);
    }
  }

  async function deleteProject() {
    if (!confirm(`确认删除项目「${project.title}」?(30 天内可恢复)`)) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`删除失败 (HTTP ${res.status})`);
      router.push("/assets");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "删除失败");
    }
  }

  const latestTask = latestTaskRaw as {
    id: string;
    project_id: string;
    user_id: string;
    mode: TaskMode;
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
    analyze_result: unknown;
    clarify_answers: unknown;
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
  } | null;

  // SSE 监听最新 task(后台还在跑就推 / 已完成就静默)
  const stream = useTaskStream(latestTaskId, {
    initialStatus: (latestTask?.status ?? "done") as never,
    initialAgentPhase: (latestTask?.agent_phase ?? null) as never,
    initialImages: [],
    initialOutline: latestTask?.analyze_result as never,
    initialErrorMessage: latestTask?.error_message ?? null,
  });

  const activeCreationMode = MODE_LABEL[project.mode];

  // 把 project 已落库图 + stream 推流图合并(去重 by taskId-pageNo,优先 stream 版本)
  const mergedImagesMap = new Map<string, ProjectImage>();
  for (const img of images) {
    mergedImagesMap.set(`${img.taskId}-${img.pageNo}`, img);
  }
  for (const img of stream.images) {
    // stream.images 没有 taskId,但 SSE 走的是 latestTaskId,所以全部归到 latestTaskId
    mergedImagesMap.set(`${latestTaskId}-${img.pageNo}`, {
      taskId: latestTaskId,
      pageNo: img.pageNo,
      pageVersion: img.pageVersion,
      role: img.role,
      url: img.url,
    });
  }
  const allImages = Array.from(mergedImagesMap.values()).sort(
    (a, b) =>
      // 先按 task 创建时间(image-1 batch 先,batch-2 后),再 pageNo
      a.taskId.localeCompare(b.taskId) || a.pageNo - b.pageNo,
  );

  function goHome() {
    router.push("/");
  }
  function goNew() {
    router.push("/task/new");
  }
  function gotoMode(mode: CreationMode) {
    // project 内切 mode = 创新项目(因为 mode 已锁)
    const m =
      mode === "AI 图文卡片"
        ? "cards"
        : mode === "AI 幻灯片"
          ? "slides"
          : "image";
    router.push(`/task/new?mode=${m}`);
  }

  async function handleAppend() {
    const text = appendText.trim();
    if (!text || appending) return;
    setAppending(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: project.mode,
          project_id: project.id,
          source_text: text,
          style_id: "auto",
          ratio: "auto",
          generation_mode: "batch",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `追加生成失败 (HTTP ${res.status})`);
      }
      // 触发 server component re-fetch — 用 router.refresh 拉新 task
      setAppendText("");
      setAppendOpen(false);
      router.refresh();
    } catch (err) {
      console.error("[ProjectWorkspace] append failed:", err);
      window.alert(err instanceof Error ? err.message : "追加生成失败");
    } finally {
      setAppending(false);
    }
  }

  // 给 TaskChatColumn 用的 task 对象(prop 类型对齐)
  const chatTaskProp = latestTask
    ? {
        id: latestTask.id,
        userId: latestTask.user_id,
        projectId: latestTask.project_id,
        mode: latestTask.mode,
        title: project.title,
        slug: latestTask.slug,
        status: latestTask.status as never,
        agentPhase: latestTask.agent_phase as never,
        sourceText: latestTask.source_text,
        sourceFileUrl: latestTask.source_file_url,
        styleId: latestTask.style_id,
        ratio: latestTask.ratio,
        generationMode: latestTask.generation_mode as never,
        templateId: latestTask.template_id,
        // M9 多语言:旧 task 可能没 locale 字段,fallback "zh"(与 schema default + repo asLocale 对齐)
        locale: ((latestTask as { locale?: string }).locale ?? "zh") as never,
        enhance: null,
        imageCount: null,
        analyzeResult: latestTask.analyze_result as never,
        clarifyAnswers: latestTask.clarify_answers as never,
        researchData: latestTask.research_data,
        currentVersionNo: latestTask.current_version_no,
        textModelUsed: latestTask.text_model_used,
        imageModelUsed: latestTask.image_model_used,
        totalCreditsCharged: latestTask.total_credits_charged,
        totalCreditsRefunded: latestTask.total_credits_refunded,
        errorMessage: latestTask.error_message,
        deletedAt: null,
        createdAt: latestTask.created_at,
        updatedAt: latestTask.updated_at,
      }
    : null;

  // canvas 用 — 拿 latest task 给 TaskCanvas(让它知道 ratio 等)
  // canvasLayout 取自 project.canvas_state(positions/sizes)
  const projectCanvasState = (project.canvasState ?? {}) as {
    positions?: Record<string, { x: number; y: number }>;
    sizes?: Record<string, { w: number; h: number }>;
  };
  const canvasTaskProp = chatTaskProp
    ? {
        ...chatTaskProp,
        // canvas 看到的 imageCount = 该 project 总图数
        imageCount: allImages.length,
        canvasLayout: {
          positions: projectCanvasState.positions ?? {},
          sizes: projectCanvasState.sizes ?? {},
        } as never,
      }
    : null;

  return (
    <main
      className={`as-home as-task-page ${sidebarCollapsed ? "as-sidebar-collapsed" : ""}`}
    >
      <AppSidebar
        activeCreationMode={activeCreationMode}
        onHome={goHome}
        onNewTask={goNew}
        onCreationModeChange={gotoMode}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      <section className="as-app-shell">
        <div className="flex h-full min-h-0">
          <section className="w-[360px] shrink-0 border-r border-outline-variant/30 bg-white flex flex-col min-h-0">
            {/* 项目标题栏 — 双击或点铅笔可改 */}
            <div className="shrink-0 flex items-center gap-1 px-md h-12 border-b border-outline-variant/20 bg-white group">
              {editingTitle ? (
                <>
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle();
                      if (e.key === "Escape") {
                        setEditingTitle(false);
                        setTitleDraft(project.title);
                      }
                    }}
                    className="flex-1 min-w-0 text-[14px] font-h3 px-1 py-0.5 rounded border border-primary-cta focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveTitle}
                    className="p-1 rounded text-primary-cta hover:bg-primary-cta/10"
                    title="保存"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTitle(false);
                      setTitleDraft(project.title);
                    }}
                    className="p-1 rounded text-on-surface-variant hover:bg-surface-container"
                    title="取消"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <h2
                    className="flex-1 truncate text-on-surface font-h3 text-[14px] cursor-text"
                    title={project.title}
                    onDoubleClick={() => setEditingTitle(true)}
                  >
                    {project.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-on-surface-variant hover:bg-surface-container transition-opacity"
                    title="重命名(双击标题也可)"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={deleteProject}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-on-surface-variant hover:bg-error/10 hover:text-error transition-opacity"
                    title="删除项目"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            {/* T2-52(2026-05-08):任务队列 chip — 同 project 多 task 时显示状态序号,
                让用户感知"我的多个任务在排队/并发"(底层是并发,UI 是队列感) */}
            {tasks.length > 1 && (
              <div className="shrink-0 px-md py-2 bg-surface-container/30 border-b border-outline-variant/20 flex items-center gap-1.5 overflow-x-auto">
                {tasks.map((tt, idx) => {
                  const isLatest = tt.id === latestTaskId;
                  // 状态映射:done/generating/cancelled/failed/思考阶段
                  const m: Record<string, { c: string; i: string; n: string }> = {
                    done: { c: "bg-emerald-100 text-emerald-700", i: "✓", n: "已完成" },
                    generating: { c: "bg-primary-cta/10 text-primary-cta", i: "⏳", n: "出图中" },
                    pending: { c: "bg-primary-cta/10 text-primary-cta", i: "💭", n: "排队中" },
                    failed: { c: "bg-error/10 text-error", i: "✕", n: "失败" },
                    cancelled: { c: "bg-surface-container text-on-surface-variant", i: "⊘", n: "已停止" },
                  };
                  const s = m[tt.status] ?? { c: "bg-surface-container text-on-surface-variant", i: "·", n: tt.status };
                  return (
                    <span
                      key={tt.id}
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.c} ${isLatest ? "ring-1 ring-primary-cta/40" : ""}`}
                      title={`${tt.title} · ${s.n} · ${new Date(tt.createdAt).toLocaleString()}`}
                    >
                      <span>{s.i}</span>
                      <span>#{idx + 1}</span>
                    </span>
                  );
                })}
              </div>
            )}
            {chatTaskProp && (
              <TaskChatColumn
                task={chatTaskProp}
                status={stream.status}
                agentPhase={stream.agentPhase}
                outline={stream.outline}
                imageCount={stream.images.length}
                streamError={stream.error}
                errorMessage={stream.errorMessage}
                hideHeader
              />
            )}
          </section>

          <section className="flex-1 min-w-0 bg-main-bg relative">
            {project.mode === "slides" ? (
              <SlideDeckView
                task={canvasTaskProp as never}
                images={allImages.map((i) => ({
                  pageNo: i.pageNo,
                  pageVersion: i.pageVersion,
                  role: i.role,
                  url: i.url,
                  taskId: i.taskId,
                }))}
                outline={(latestTask?.analyze_result as never) ?? null}
              />
            ) : (
              <TaskCanvas
                task={canvasTaskProp as never}
                images={allImages.map((i) => ({
                  pageNo: i.pageNo,
                  pageVersion: i.pageVersion,
                  role: i.role,
                  url: i.url,
                  taskId: i.taskId,
                }))}
                outline={(latestTask?.analyze_result as never) ?? null}
                projectId={project.id}
              />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
