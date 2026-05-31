// SPEC §2.1 Step 3 顶部状态："工作中 0s · 0/5"
// 5 phase = analyze / clarify / outline / confirm / batch
//
// agentPhase 没赋值时 fallback 用 status 推 phase，避免 0/5 一直停滞。

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AgentPhase, TaskStatus } from "@/lib/tasks/types";

type Props = {
  status: TaskStatus;
  agentPhase: AgentPhase | null;
};

/** SPEC §2.1 5 phase 顺序，1-based */
const PHASE_INDEX: Record<NonNullable<AgentPhase>, number> = {
  analyze: 1,
  clarify: 2,
  outline: 3,
  confirm: 3,
  cover: 4,
  batch: 5,
  done: 5,
};

/** status 兜底映射（agentPhase 还没写入时用 status 推） */
const STATUS_PHASE_FALLBACK: Record<TaskStatus, number> = {
  created: 0,
  analyzing: 1,
  clarifying: 2,
  outlining: 3,
  confirming: 3,
  confirming_source: 1,
  generating: 5,
  done: 5,
  failed: 0,
  cancelled: 0,
};

const STATUS_LABEL_KEY: Record<TaskStatus, string> = {
  created: "taskStatus.created",
  analyzing: "taskStatus.analyzing",
  clarifying: "taskStatus.clarifying",
  outlining: "taskStatus.outlining",
  confirming: "taskStatus.confirming",
  confirming_source: "taskStatus.confirming",
  generating: "taskStatus.generating",
  done: "taskStatus.done",
  failed: "taskStatus.failed",
  cancelled: "taskStatus.cancelled",
};

const TERMINAL_STATUSES: TaskStatus[] = ["done", "failed", "cancelled"];

export function TaskStatusBar({ status, agentPhase }: Props) {
  const t = useTranslations();
  const [elapsedSec, setElapsedSec] = useState(0);
  const isActive = !TERMINAL_STATUSES.includes(status);

  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setElapsedSec((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  const phaseNum = agentPhase
    ? PHASE_INDEX[agentPhase]
    : STATUS_PHASE_FALLBACK[status];
  const label = t(STATUS_LABEL_KEY[status] as never);

  return (
    <div className="flex items-center gap-md text-label font-label">
      {isActive ? (
        <span className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-cta/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-cta" />
          </span>
          <span className="text-on-surface-variant">{label}</span>
        </span>
      ) : (
        <span
          className={`px-2 py-0.5 rounded-full text-[12px] ${
            status === "done"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : status === "failed"
                ? "bg-error-container text-error border border-red-200"
                : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {label}
        </span>
      )}
      <span className="text-on-surface-variant tabular-nums">
        {elapsedSec}s · {phaseNum}/5
      </span>
    </div>
  );
}
