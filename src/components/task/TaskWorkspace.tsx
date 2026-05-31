// SPEC §2.1 Step 3 + §2.8.1 — 任务工作区(三列布局,无顶栏)
//
// 三列:
//   左 — AppSidebar(可折叠,与首页同款)
//   中 — Chat 列(自带 title bar / phase 条 / 消息流 / 输入框,工具按钮收在标题右侧 menu)
//   右 — 自由画布(满高度,纯画布,无顶栏)

"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TaskChatColumn } from "./TaskChatColumn";
import { TaskCanvas } from "./TaskCanvas";
import { SlideDeckView } from "./SlideDeckView";
import { useTaskStream } from "./useTaskStream";
import type { TaskRecord, TaskMode } from "@/lib/tasks/types";
import type { SlidesAnalyzeOutput } from "@/lib/slides/agents";

type TaskApiResponse = Omit<TaskRecord, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  images?: Array<{
    pageNo: number;
    pageVersion: number;
    role: string | null;
    url: string;
  }>;
  canvasLayout?: {
    positions?: Record<string, { x: number; y: number }>;
    sizes?: Record<string, { w: number; h: number }>;
  } | null;
};

type Props = { task: TaskApiResponse };

type CreationMode = "AI 图文卡片" | "AI 幻灯片" | "AI 图片";
const MODE_LABEL: Record<TaskMode, CreationMode> = {
  cards: "AI 图文卡片",
  slides: "AI 幻灯片",
  image: "AI 图片",
};
const MODE_QUERY: Record<CreationMode, TaskMode> = {
  "AI 图文卡片": "cards",
  "AI 幻灯片": "slides",
  "AI 图片": "image",
};

export function TaskWorkspace({ task }: Props) {
  const router = useRouter();
  // 2026-05-09 PR10:task 类页面默认收起 sidebar 给主区(幻灯片预览/画布)更多空间
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const stream = useTaskStream(task.id, {
    initialStatus: task.status,
    initialAgentPhase: task.agentPhase,
    initialImages: task.images ?? [],
    initialOutline: (task.analyzeResult as never) ?? null,
    initialErrorMessage: task.errorMessage ?? null,
  });

  const activeCreationMode = MODE_LABEL[task.mode];

  function goHome() {
    router.push("/");
  }
  function goToTool() {
    router.push("/task/new");
  }
  function gotoMode(mode: CreationMode) {
    router.push(`/task/new?mode=${MODE_QUERY[mode]}`);
  }

  return (
    <main
      className={`as-home as-task-page ${sidebarCollapsed ? "as-sidebar-collapsed" : ""}`}
    >
      <AppSidebar
        activeCreationMode={activeCreationMode}
        onHome={goHome}
        onNewTask={goToTool}
        onCreationModeChange={gotoMode}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* 主区:无顶栏,直接两栏 */}
      <section className="as-app-shell">
        <div className="flex h-full min-h-0">
          <section className="w-[360px] shrink-0 border-r border-outline-variant/30 bg-white flex flex-col min-h-0">
            <TaskChatColumn
              task={task}
              status={stream.status}
              agentPhase={stream.agentPhase}
              outline={stream.outline}
              imageCount={stream.images.length}
              streamError={stream.error}
              errorMessage={stream.errorMessage}
              onReconnectStream={stream.reconnect}
            />
          </section>

          <section className="flex-1 min-w-0 bg-main-bg relative">
            {task.mode === "slides" ? (
              <SlideDeckView
                task={task}
                images={stream.images}
                outline={stream.outline as SlidesAnalyzeOutput | null}
              />
            ) : (
              <TaskCanvas
                task={task}
                images={stream.images}
                outline={stream.outline}
              />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
