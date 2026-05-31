// Phase 6 PR40 — 元素级标注修改前端组件
//
// 职责:
//   - 监听 iframe 通过 postMessage 发来的 anyslide:annotate-element 事件
//   - 在 hover 元素旁弹浮层输入框 "怎么改?"
//   - 收集用户输入到 annotations[] 待应用清单
//   - 顶部固定卡片显示 "已标 N 项 + 应用所有修改"
//   - 提交时 POST /api/tasks/[id]/refine-elements
//   - 成功后通过 onApplied 回调通知 parent 触发 reload
//
// 用法(在 L1TemplateDeckView 里):
//   <AnnotationOverlay
//     taskId={task.id}
//     annotationMode={annotationMode}
//     setAnnotationMode={setAnnotationMode}
//     onApplied={() => triggerReload()}
//   />

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Plus, Trash2, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnnotationMessage } from "@/lib/slides/annotation/inject-script";
import { ANNOTATION_MESSAGE_TYPE } from "@/lib/slides/annotation/inject-script";

interface Annotation {
  pageNo: number;
  selector: string;
  currentText: string;
  instruction: string;
  sectionRole?: string;
}

interface ActiveAnnotation {
  pageNo: number;
  selector: string;
  currentText: string;
  sectionRole?: string;
  /** 浮层在 viewport 的目标位置(相对 iframe 容器) */
  position: { top: number; left: number };
}

interface Props {
  taskId: string;
  annotationMode: boolean;
  setAnnotationMode: (b: boolean) => void;
  /** 应用成功后调,父组件可以触发 SSE reconnect / 让 SlideDeckView 拿新 deck */
  onApplied?: () => void;
}

export function AnnotationOverlay({
  taskId,
  annotationMode,
  setAnnotationMode,
  onApplied,
}: Props) {
  const t = useTranslations("annotation");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [active, setActive] = useState<ActiveAnnotation | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 监听 iframe postMessage
  useEffect(() => {
    if (!annotationMode) {
      // 关闭标注模式时清空 active(prop 变化驱动的 state reset,合理 setState in effect)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(null);
      return;
    }
    function onMsg(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type !== ANNOTATION_MESSAGE_TYPE) return;
      const msg = ev.data as AnnotationMessage;
      // 浮层位置:元素右下角(viewport 坐标,我们用 fixed 定位)
      setActive({
        pageNo: msg.pageNo,
        selector: msg.selector,
        currentText: msg.currentText,
        sectionRole: msg.sectionRole,
        position: {
          top: Math.min(window.innerHeight - 200, msg.rect.top + msg.rect.height + 8),
          left: Math.min(window.innerWidth - 380, msg.rect.left),
        },
      });
      setPendingInstruction("");
      setError(null);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [annotationMode]);

  // 输入框 autofocus
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // ESC 关闭浮层
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const addCurrent = useCallback(() => {
    if (!active || !pendingInstruction.trim()) return;
    setAnnotations((prev) => [
      ...prev,
      {
        pageNo: active.pageNo,
        selector: active.selector,
        currentText: active.currentText,
        instruction: pendingInstruction.trim(),
        sectionRole: active.sectionRole,
      },
    ]);
    setActive(null);
    setPendingInstruction("");
  }, [active, pendingInstruction]);

  const removeAnnotation = useCallback((idx: number) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearAll = useCallback(() => {
    setAnnotations([]);
    setError(null);
    setAppliedSummary(null);
  }, []);

  const applyAll = useCallback(async () => {
    if (annotations.length === 0 || applying) return;
    setApplying(true);
    setError(null);
    setAppliedSummary(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/refine-elements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        applied?: number;
        skipped?: Array<{ selector: string; reason: string }>;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const skippedCount = data.skipped?.length ?? 0;
      setAppliedSummary(
        t("appliedSummary", {
          applied: data.applied ?? 0,
          skippedNote: skippedCount > 0 ? t("skippedAddon", { n: skippedCount }) : "",
        }),
      );
      setAnnotations([]);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("applyFailed"));
    } finally {
      setApplying(false);
    }
  }, [annotations, applying, taskId, onApplied, t]);

  return (
    <>
      {/* 顶部固定卡片:已标 N 项 + 应用按钮(标注模式激活时显示)*/}
      {annotationMode && (
        <div className="fixed top-20 right-6 z-50 w-[320px] rounded-xl bg-white shadow-brown border border-outline-variant/40 p-md text-on-surface">
          <div className="flex items-center justify-between mb-sm">
            <span className="text-label font-label">📝 {t("modeOn")}</span>
            <button
              type="button"
              onClick={() => {
                setAnnotationMode(false);
                clearAll();
              }}
              className="text-on-surface-variant hover:text-on-surface"
              title={t("modeOff")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {annotations.length === 0 ? (
            <p className="text-body-small text-on-surface-variant">
              {t("emptyHint")}
            </p>
          ) : (
            <>
              <ul className="space-y-1 max-h-[280px] overflow-y-auto text-body-small">
                {annotations.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1 p-2 rounded bg-surface-container/70 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-on-surface-variant truncate text-[11px]">
                        {t("pageLabel", { n: a.pageNo })} · {a.currentText.slice(0, 30)}
                        {a.currentText.length > 30 ? "…" : ""}
                      </div>
                      <div className="text-on-surface">→ {a.instruction}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAnnotation(i)}
                      className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={applyAll}
                disabled={applying}
                className="mt-md w-full flex items-center justify-center gap-2 px-md py-sm rounded-lg bg-primary-cta text-on-primary text-label font-label disabled:opacity-50 hover:bg-primary-container transition-colors"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("applying")}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t("applyAll", { n: annotations.length, credits: Math.ceil(annotations.length * 0.5) })}</span>
                  </>
                )}
              </button>
            </>
          )}
          {appliedSummary && (
            <div className="mt-sm text-body-small text-green-700">
              ✅ {appliedSummary}
            </div>
          )}
          {error && (
            <div className="mt-sm text-body-small text-error">
              ❌ {error}
            </div>
          )}
        </div>
      )}

      {/* 浮层输入框(active 时显示)*/}
      {annotationMode && active && (
        <div
          className="fixed z-[60] w-[360px] rounded-xl bg-white shadow-brown border border-primary-cta p-md"
          style={{ top: active.position.top, left: active.position.left }}
        >
          <div className="flex items-center justify-between mb-sm">
            <span className="text-body-small text-on-surface-variant">
              {t("pageLabel", { n: active.pageNo })} · {t("selectedLabel")}&quot;{active.currentText.slice(0, 24)}
              {active.currentText.length > 24 ? "…" : ""}&quot;
            </span>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-on-surface-variant hover:text-on-surface"
              title={t("cancelEsc")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={pendingInstruction}
            onChange={(e) => setPendingInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                addCurrent();
              }
              if (e.key === "Escape") setActive(null);
            }}
            placeholder={t("inputPlaceholder")}
            rows={2}
            className="w-full px-sm py-sm rounded-md border border-outline-variant text-body resize-none focus:outline-none focus:ring-2 focus:ring-primary-cta/30"
          />
          <div className="mt-sm flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant">{t("enterShortcut")}</span>
            <button
              type="button"
              onClick={addCurrent}
              disabled={!pendingInstruction.trim()}
              className="flex items-center gap-1 px-sm py-1.5 rounded-md bg-primary-cta text-on-primary text-body-small font-label disabled:opacity-50 hover:bg-primary-container transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("addToList")}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
