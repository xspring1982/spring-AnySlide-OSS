// 抽出 TaskWorkspace 的内 2 列内容(chat + canvas/slides),
// 让 NewTaskWorkspace 提交后无缝替换内嵌内容,
// 外壳(AppSidebar + as-app-shell)共享,视觉上无切换感。

"use client";

import { TaskChatColumn } from "./TaskChatColumn";
import { TaskCanvas } from "./TaskCanvas";
import { SlideDeckView } from "./SlideDeckView";
import { useTaskStream } from "./useTaskStream";
import type { TaskRecord } from "@/lib/tasks/types";
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

export function TaskWorkspaceInner({ task }: { task: TaskApiResponse }) {
  const stream = useTaskStream(task.id, {
    initialStatus: task.status,
    initialAgentPhase: task.agentPhase,
    initialImages: task.images ?? [],
    initialOutline: (task.analyzeResult as never) ?? null,
    initialErrorMessage: task.errorMessage ?? null,
  });

  return (
    <>
      <section className="w-[360px] shrink-0 border-r border-outline-variant/30 bg-white flex flex-col min-h-0">
        <TaskChatColumn
          task={task}
          status={stream.status}
          agentPhase={stream.agentPhase}
          outline={stream.outline}
          imageCount={stream.images.length}
          streamError={stream.error}
          errorMessage={stream.errorMessage}
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
    </>
  );
}
