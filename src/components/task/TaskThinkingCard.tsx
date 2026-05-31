// SPEC §3.1 anygen-style「AI 思考过程」持久卡
//
// 把每个 agent phase 折成可展开行,带耗时显示 + 中间产物 preview。
// 状态(analyzing/outlining/confirming/generating-cover/generating-batch/done)
// 在客户端通过 useEffect 监听变化打时间戳;done 之后整卡始终可见。
// 不依赖后端补 phase 历史 —— 第一阶段够用,后端补全后无缝替换。

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TaskStatus, AgentPhase } from "@/lib/tasks/types";

// ─────────────────────── 步骤定义 ───────────────────────

type StepKey =
  | "analyze"
  | "outline"
  | "confirm"
  | "cover"
  | "batch";

interface StepDef {
  key: StepKey;
  label: string;
  /** 进入此步骤的状态判定 */
  enters: (status: TaskStatus, phase: AgentPhase | null) => boolean;
}

// label 改 i18n key,使用处 t() 解
type StepDefKey = Omit<StepDef, "label"> & { labelKey: string };
const STEPS: StepDefKey[] = [
  { key: "analyze", labelKey: "thinkingCard.stepAnalyze", enters: (s) => s === "analyzing" },
  { key: "outline", labelKey: "thinkingCard.stepOutline", enters: (s) => s === "outlining" },
  { key: "confirm", labelKey: "thinkingCard.stepConfirm", enters: (s) => s === "confirming" },
  { key: "cover", labelKey: "thinkingCard.stepCover", enters: (s, p) => s === "generating" && p === "cover" },
  { key: "batch", labelKey: "thinkingCard.stepBatch", enters: (s, p) => s === "generating" && p === "batch" },
];

interface StepRecord {
  key: StepKey;
  label: string;
  /** 进入该步骤的客户端时间戳 */
  startedAt: number;
  /** 离开该步骤的时间戳;还在当前则 null */
  endedAt: number | null;
}

// ─────────────────────── 主组件 ───────────────────────

export interface ThinkingCardProps {
  status: TaskStatus;
  agentPhase: AgentPhase | null;
  /** outline 渲染槽:大纲卡 / 大纲条目数等;调用方传 React 节点即可 */
  outlinePreview?: React.ReactNode;
  /** 进度统计:已出图数 / 应出总数 —— batch 步骤展开时用 */
  imageCount?: number;
  totalCount?: number;
  /** 任务模式 — image 模式下 batch step label 改成"生成图片",清晰 */
  mode?: "cards" | "image" | "slides";
}

export function TaskThinkingCard({
  status,
  agentPhase,
  outlinePreview,
  imageCount = 0,
  totalCount = 0,
  mode,
}: ThinkingCardProps) {
  const t = useTranslations();
  const [history, setHistory] = useState<StepRecord[]>([]);
  const [openKey, setOpenKey] = useState<StepKey | null>(null);
  // 客户端 mount 后才有真实时间戳,避免 SSR/CSR 不一致
  const [tickNow, setTickNow] = useState<number>(0);
  const lastKeyRef = useRef<StepKey | null>(null);

  const isTerminal =
    status === "done" || status === "failed" || status === "cancelled";

  // 单 effect 把所有 history 变更归一处理:
  //   - status/phase 切换 → 关上一步 + 开新步
  //   - 终态 → 把所有未关步全关掉
  useEffect(() => {
    const now = Date.now();
    const current = isTerminal
      ? null
      : STEPS.find((s) => s.enters(status, agentPhase))?.key ?? null;
    if (current === lastKeyRef.current && !isTerminal) return;

    setHistory((prev) => {
      const next = prev.slice();
      // 关旧
      if (lastKeyRef.current) {
        const idx = next.findIndex((r) => r.key === lastKeyRef.current);
        if (idx >= 0 && next[idx].endedAt === null) {
          next[idx] = { ...next[idx], endedAt: now };
        }
      }
      // 终态 → 兜底关所有未关的
      if (isTerminal) {
        return next.map((r) => (r.endedAt === null ? { ...r, endedAt: now } : r));
      }
      // 开新
      if (current && !next.some((r) => r.key === current)) {
        const def = STEPS.find((s) => s.key === current);
        if (def) {
          next.push({ key: current, label: def.labelKey, startedAt: now, endedAt: null });
        }
      }
      return next;
    });
    lastKeyRef.current = isTerminal ? null : current;
  }, [status, agentPhase, isTerminal]);

  // 进行中步骤的秒针 — 仅在客户端 mount 后启动 / SSR 时 tickNow=0 跳过渲染。
  // 全部 setState 都走 setTimeout / setInterval 回调,符合 react-hooks/set-state-in-effect。
  useEffect(() => {
    const kick = setTimeout(() => setTickNow(Date.now()), 0);
    if (isTerminal) {
      return () => clearTimeout(kick);
    }
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      clearTimeout(kick);
    };
  }, [isTerminal]);

  if (history.length === 0 || tickNow === 0) return null;

  const totalElapsed = history.reduce((sum, r) => {
    const end = r.endedAt ?? tickNow;
    return sum + Math.max(0, end - r.startedAt);
  }, 0);

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-white shadow-sm overflow-hidden">
      <div className="px-md py-2.5 flex items-center gap-2 bg-surface-container-low border-b border-outline-variant/30">
        <span className="text-[12px] font-label uppercase tracking-wider text-on-surface-variant">
          {t("thinkingCard.title")}
        </span>
        <span className="text-[11px] text-on-surface-variant/70 ml-auto">
          {isTerminal ? t("thinkingCard.terminal") : t("thinkingCard.running")} · {t("thinkingCard.elapsed", { d: formatDuration(totalElapsed) })}
        </span>
      </div>
      <ul className="divide-y divide-outline-variant/20">
        {history.map((rec) => {
          const isOpen = openKey === rec.key;
          const isRunning = rec.endedAt === null;
          const elapsed = (rec.endedAt ?? tickNow) - rec.startedAt;
          const duration = formatDuration(elapsed);
          const expandable = rec.key === "outline" || rec.key === "batch";
          return (
            <li key={rec.key}>
              <button
                type="button"
                disabled={!expandable}
                onClick={() => setOpenKey(isOpen ? null : rec.key)}
                className={`w-full flex items-center gap-2 px-md py-2 text-left transition-colors ${
                  expandable ? "hover:bg-surface-container-low cursor-pointer" : "cursor-default"
                } ${isRunning ? "bg-primary-cta/4" : ""}`}
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary-cta animate-spin shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 text-emerald-600">
                    ✓
                  </span>
                )}
                <span
                  className={`flex-1 min-w-0 truncate text-[13px] ${
                    isRunning ? "text-on-surface font-medium" : "text-on-surface-variant"
                  }`}
                >
                  {/* image 模式下,batch 步骤改名(单图,无"批量"概念)*/}
                  {mode === "image" && rec.key === "batch"
                    ? t("thinkingCard.stepImageGen")
                    : t(rec.label as never)}
                </span>
                <span
                  className={`text-[11px] tabular-nums shrink-0 ${
                    isRunning ? "text-primary-cta" : "text-on-surface-variant/60"
                  }`}
                >
                  {duration}
                </span>
                {expandable && (
                  <span className="shrink-0 text-on-surface-variant/60">
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="px-md py-2.5 bg-surface-container-low/60 border-t border-outline-variant/20">
                  {rec.key === "outline" && outlinePreview}
                  {rec.key === "batch" && (
                    <div className="text-[12px] text-on-surface-variant flex items-center gap-2">
                      <span>
                        {t("thinkingCard.batchProgress", {
                          done: imageCount,
                          total: totalCount || "?",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────── utils ───────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
