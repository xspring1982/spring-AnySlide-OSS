// SPEC §2.8.1 Chat 列底部"── 历史 ──"区
// 5 phase 时间线：analyze / clarify / outline / confirm / batch
//
// 三种渲染态：
//   - done：✓ 圆形描边 + 灰文
//   - active：橙色填充 + 加粗（ping 动画）
//   - pending：浅灰描边 + 灰文
//
// SPEC §2.1 状态↔phase 映射：
//   created → 0 个 done，0 个 active（全 pending）
//   analyzing → 0 done，analyze active
//   clarifying → 1 done（analyze），clarify active
//   outlining → 2 done，outline active
//   confirming → 3 done，confirm active（即 outline 后等用户确认）
//   generating → 4 done，batch active
//   done → 5 done
//   failed / cancelled → 中断态，按当前 agentPhase 显示

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TaskStatus, AgentPhase } from "@/lib/tasks/types";

type Phase = {
  key: AgentPhase;
  /** i18n key — 在使用处 t() 解 */
  labelKey: string;
  emoji: string;
};

const PHASES: Phase[] = [
  { key: "analyze", labelKey: "phaseTimeline.cards.analyze", emoji: "🔍" },
  { key: "clarify", labelKey: "phaseTimeline.cards.clarify", emoji: "🛑" },
  { key: "outline", labelKey: "phaseTimeline.cards.outline", emoji: "✏️" },
  { key: "confirm", labelKey: "phaseTimeline.cards.confirm", emoji: "🛑" },
  { key: "batch", labelKey: "phaseTimeline.cards.batch", emoji: "🎨" },
];

const IMAGE_PHASES: Phase[] = [
  { key: "analyze", labelKey: "phaseTimeline.image.analyze", emoji: "✨" },
  { key: "batch", labelKey: "phaseTimeline.image.batch", emoji: "🎨" },
];

const IMAGE_STATUS_DONE_COUNT: Record<TaskStatus, number> = {
  created: 0,
  analyzing: 0,
  clarifying: 1,
  outlining: 1,
  confirming: 1,
  confirming_source: 0,
  generating: 1,
  done: 2,
  failed: 0,
  cancelled: 0,
};

/** status → 已完成 phase 数（0-5） */
const STATUS_DONE_COUNT: Record<TaskStatus, number> = {
  created: 0,
  analyzing: 0,
  clarifying: 1, // analyze done
  outlining: 2,  // analyze + clarify done
  confirming: 3, // analyze + clarify + outline done
  confirming_source: 1, // 文稿 gate(保真模式,大纲之前)
  generating: 4, // 全部介入完成
  done: 5,
  failed: 0,     // failed 时按 agentPhase 推（见下面 logic）
  cancelled: 0,
};

/** status → 当前激活 phase（0-based index 或 -1 表示无激活） */
function getActiveIndex(status: TaskStatus, agentPhase: AgentPhase | null): number {
  if (agentPhase) {
    const i = PHASES.findIndex((p) => p.key === agentPhase);
    if (i >= 0) return i;
  }
  switch (status) {
    case "analyzing":
      return 0;
    case "clarifying":
      return 1;
    case "outlining":
      return 2;
    case "confirming":
      return 3;
    case "generating":
      return 4;
    default:
      return -1;
  }
}

type Props = {
  status: TaskStatus;
  agentPhase: AgentPhase | null;
  mode?: "cards" | "slides" | "image";
};

/**
 * 紧凑横向进度条 — Chat 列顶部用
 * 设计:左侧标签(当前 step + N/5)+ 右侧整段连续进度条
 * 比离散 5 dot 干净,适合 360px 窄列
 */
export function CompactPhaseStrip({ status, agentPhase, mode }: Props) {
  const t = useTranslations();
  const phases = mode === "image" ? IMAGE_PHASES : PHASES;
  const statusMap = mode === "image" ? IMAGE_STATUS_DONE_COUNT : STATUS_DONE_COUNT;
  const doneCount = statusMap[status];
  const activeIndex = mode === "image"
    ? (status === "analyzing" ? 0 : status === "generating" ? 1 : -1)
    : getActiveIndex(status, agentPhase);
  const total = phases.length;

  let fillRatio: number;
  let label: string;
  let toneClass: string;
  if (status === "done") {
    fillRatio = 1;
    label = `${total}/${total} · ${t("taskStatus.done")}`;
    toneClass = "bg-emerald-500";
  } else if (status === "failed" || status === "cancelled") {
    fillRatio = doneCount / total;
    label = status === "failed" ? t("taskStatus.failed") : t("taskStatus.cancelled");
    toneClass = "bg-error";
  } else if (activeIndex >= 0) {
    fillRatio = (doneCount + 0.5) / total;
    // labelKey 翻译后已含 "Step N XXX",这里去掉 "Step N " 前缀只留 phase 名
    const fullLabel = t(phases[activeIndex].labelKey as never);
    const currentLabel = fullLabel.replace(/^Step \d+\s*/, "");
    label = `${activeIndex + 1}/${total} · ${currentLabel}`;
    toneClass = "bg-primary-cta";
  } else {
    fillRatio = 0;
    label = t("phaseTimeline.waiting");
    toneClass = "bg-surface-container";
  }

  const isActive = status !== "done" && status !== "failed" && status !== "cancelled";

  return (
    <div className="flex items-center gap-sm">
      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${toneClass} ${
            isActive ? "animate-pulse" : ""
          }`}
          style={{ width: `${Math.max(4, fillRatio * 100)}%` }}
        />
      </div>
      <span
        className={`shrink-0 text-[11px] font-label tabular-nums whitespace-nowrap ${
          status === "done"
            ? "text-emerald-700"
            : status === "failed" || status === "cancelled"
              ? "text-error"
              : "text-on-surface-variant"
        }`}
      >
        {status === "done" ? <Check className="w-3 h-3 inline mr-0.5" strokeWidth={3} /> : null}
        {label}
      </span>
    </div>
  );
}

export function PhaseTimeline({ status, agentPhase }: Props) {
  const t = useTranslations();
  const doneCount = STATUS_DONE_COUNT[status];
  const activeIndex = getActiveIndex(status, agentPhase);

  return (
    <div className="border-t border-outline-variant/30 px-md py-md">
      <div className="text-[12px] font-label text-on-surface-variant mb-sm uppercase tracking-wider">
        {t("phaseTimeline.history")}
      </div>
      <ol className="flex flex-col gap-2">
        {PHASES.map((phase, i) => {
          const isDone = i < doneCount;
          const isActive = i === activeIndex;
          return (
            <li key={phase.key} className="flex items-center gap-sm">
              {/* 状态图标 */}
              <span
                className={`relative flex w-5 h-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                  isDone
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                    : isActive
                      ? "bg-primary-cta text-on-primary"
                      : "bg-surface-container border border-outline-variant/40 text-on-surface-variant"
                }`}
              >
                {isDone ? (
                  <Check className="w-3 h-3" strokeWidth={3} />
                ) : isActive ? (
                  <>
                    <span className="absolute inset-0 rounded-full bg-primary-cta animate-ping opacity-40" />
                    <span className="relative">{i + 1}</span>
                  </>
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              {/* 标签 */}
              <span
                className={`text-[13px] font-label ${
                  isDone
                    ? "text-on-surface-variant line-through opacity-60"
                    : isActive
                      ? "text-on-surface font-semibold"
                      : "text-on-surface-variant opacity-70"
                }`}
              >
                <span className="mr-1">{phase.emoji}</span>
                {t(phase.labelKey as never)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
