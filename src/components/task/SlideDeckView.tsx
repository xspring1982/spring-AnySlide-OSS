// SPEC §3.7 — Slides 任务页:幻灯片预览(对齐竞品 4 列布局)
// 整体外观:
//   左侧(由 TaskWorkspace 给):AppSidebar | Chat 列
//   本组件内部:中央主预览(1fr) + 右侧缩略图 rail(180px)
//   缩略图卡渲染真实预览(L1 iframe scale / L2 img),非纯文字列表
//   顶部"+ 新建幻灯片"占位 + 折叠按钮(M2 接入)
// 上下键 / Page Up/Down 切换 slide

"use client";

import { useTranslations } from "next-intl";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Download,
  GripVertical,
  ImageIcon,
  Maximize2,
  Plus,
  X,
} from "lucide-react";
import type { TaskRecord } from "@/lib/tasks/types";
import type { StreamedImage } from "./useTaskStream";
import type { SlidesAnalyzeOutput } from "@/lib/slides/agents";
import type { SlideStyle } from "@/lib/slides/styles/types";
import { buildBaseCss } from "@/lib/slides/styles/wrap-css";
import { getSlideStyle } from "@/lib/slides/styles";
import type { SlideStyleId } from "@/lib/slides/styles/types";
// Phase 6:元素级标注修改
import { AnnotationOverlay } from "./AnnotationOverlay";
import { buildAnnotationInjectScript } from "@/lib/slides/annotation/inject-script";

type TaskApiResponse = Omit<TaskRecord, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type Props = {
  task: TaskApiResponse;
  images: StreamedImage[];
  outline: SlidesAnalyzeOutput | null;
};

interface SlideRow {
  index: number;
  role: string;
  title: string;
  url: string | null;
  isHtml: boolean;
}

function flattenSlides(outline: SlidesAnalyzeOutput | null): Array<{
  index: number;
  role: string;
  title: string;
}> {
  if (!outline) return [];
  const out: Array<{ index: number; role: string; title: string }> = [
    { index: outline.outline.cover.index, role: "cover", title: outline.outline.cover.title },
  ];
  if (outline.outline.agenda) {
    out.push({
      index: outline.outline.agenda.index,
      role: "agenda",
      title: outline.outline.agenda.title,
    });
  }
  for (const sec of outline.outline.sections) {
    if (sec.divider) {
      out.push({
        index: sec.divider.index,
        role: "section_divider",
        title: sec.divider.title,
      });
    }
    for (const s of sec.slides) {
      out.push({ index: s.index, role: "content", title: s.title });
    }
  }
  out.push({
    index: outline.outline.closing.index,
    role: "closing",
    title: outline.outline.closing.title,
  });
  return out;
}

export function SlideDeckView({ task, images, outline }: Props) {
  const t = useTranslations();
  const [activeIndex, setActiveIndex] = useState(1);
  const [railCollapsed, setRailCollapsed] = useState(false);
  // M5+ T2-31:从 task.styleId 解析 SlideStyle,传给 iframe wrapper 让 base CSS 按风格生成
  const slideStyle = useMemo<SlideStyle | null>(() => {
    if (!task.styleId || task.styleId === "auto") return null;
    try {
      return getSlideStyle(task.styleId as SlideStyleId);
    } catch {
      return null;
    }
  }, [task.styleId]);
  // 用户在缩略图 rail 拖拽产生的本地顺序;首次渲染前为 null = 用 outline 自然顺序
  const [customOrder, setCustomOrder] = useState<number[] | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // 演示模式(全屏放映)
  const [presenting, setPresenting] = useState(false);

  // L1 模板填充模式:整个 deck 是一个完整 HTML(单 task_file,带内置翻页器)
  // 检测:有 templateId + 仅 1 张图 + 是 data:text/html URL
  const isL1TemplateDeck = useMemo(() => {
    return Boolean(
      task.templateId &&
        images.length === 1 &&
        images[0]?.url?.startsWith("data:text/html"),
    );
  }, [task.templateId, images]);

  const slides: SlideRow[] = useMemo(() => {
    const flat = flattenSlides(outline);
    const byPage = new Map<number, StreamedImage>();
    for (const img of images) byPage.set(img.pageNo, img);

    if (flat.length === 0 && images.length === 0) {
      // 任务还没拿到 outline,显示占位
      return [];
    }
    if (flat.length === 0) {
      // 仅 images(应不该发生),fallback 用 image 列
      return images.map((img) => ({
        index: img.pageNo,
        role: img.role ?? "content",
        title: `第 ${img.pageNo} 张`,
        url: img.url,
        isHtml: img.url.startsWith("data:text/html"),
      }));
    }
    return flat.map((s) => {
      const img = byPage.get(s.index);
      return {
        index: s.index,
        role: s.role,
        title: s.title,
        url: img?.url ?? null,
        isHtml: !!img && img.url.startsWith("data:text/html"),
      };
    });
  }, [outline, images]);

  // 应用用户拖拽产生的自定义顺序;customOrder=null 时直接走 slides 自然顺序
  const orderedSlides: SlideRow[] = useMemo(() => {
    if (!customOrder) return slides;
    const byIndex = new Map(slides.map((s) => [s.index, s]));
    const out: SlideRow[] = [];
    for (const idx of customOrder) {
      const s = byIndex.get(idx);
      if (s) out.push(s);
    }
    // 防御:任何不在 customOrder 里的新 slide(后端追加)拼到尾部
    for (const s of slides) {
      if (!customOrder.includes(s.index)) out.push(s);
    }
    return out;
  }, [slides, customOrder]);

  // 启动时从 localStorage 拉一次自定义顺序
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`slide-order:${task.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        setCustomOrder(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [task.id]);

  // customOrder 变了 → 落 localStorage(刷新后保留)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!customOrder) return;
    window.localStorage.setItem(
      `slide-order:${task.id}`,
      JSON.stringify(customOrder),
    );
  }, [customOrder, task.id]);

  function moveSlide(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const baseOrder = customOrder ?? orderedSlides.map((s) => s.index);
    const next = baseOrder.slice();
    const [moved] = next.splice(fromIdx, 1);
    if (moved === undefined) return;
    next.splice(toIdx, 0, moved);
    setCustomOrder(next);
  }

  // 默认选第一张
  useEffect(() => {
    if (orderedSlides.length > 0 && !orderedSlides.find((s) => s.index === activeIndex)) {
      setActiveIndex(orderedSlides[0].index);
    }
  }, [orderedSlides, activeIndex]);

  // 演示者备注:Record<slideIndex, string>,localStorage 持久化
  const [notes, setNotes] = useState<Record<number, string>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`slide-notes:${task.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setNotes(parsed);
    } catch {
      /* ignore */
    }
  }, [task.id]);
  function setNote(slideIndex: number, value: string) {
    setNotes((prev) => {
      const next = { ...prev, [slideIndex]: value };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(`slide-notes:${task.id}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  // 键盘导航(F5 演示模式 / Esc 退出 / 方向键翻页)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (orderedSlides.length === 0) return;
      // 输入框 / textarea 内不拦截方向键
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inEditable = tag === "input" || tag === "textarea";
      if (e.key === "F5" && !inEditable) {
        e.preventDefault();
        setPresenting(true);
        return;
      }
      if (e.key === "Escape" && presenting) {
        setPresenting(false);
        return;
      }
      if (inEditable && !presenting) return;
      const idx = orderedSlides.findIndex((s) => s.index === activeIndex);
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        if (idx < orderedSlides.length - 1) setActiveIndex(orderedSlides[idx + 1].index);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        if (idx > 0) setActiveIndex(orderedSlides[idx - 1].index);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderedSlides, activeIndex, presenting]);

  const active = orderedSlides.find((s) => s.index === activeIndex) ?? orderedSlides[0];

  if (orderedSlides.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
        <div className="text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-md opacity-30" />
          <p className="font-h3 text-h3 text-on-surface mb-sm">{t("slideDeck.waiting")}</p>
          <p className="font-label text-label opacity-70">
            生成完成后会出现幻灯片缩略图列 + 中央预览
          </p>
        </div>
      </div>
    );
  }

  const ratio = task.ratio || "16:9";

  // ─── L1 模板填充模式:全屏单 iframe(模板自带翻页器)───
  if (isL1TemplateDeck) {
    return <L1TemplateDeckView task={task} images={images} ratio={ratio} t={t} />;
  }

  return (
    <div className="w-full h-full flex bg-main-bg overflow-hidden">
      {/* 中央主预览(1fr) */}
      <section className="flex-1 min-w-0 relative flex flex-col">
        {/* 顶部 toolbar:角色徽章 + 翻页 + 计数器 + 比例 */}
        <header className="shrink-0 h-10 px-md flex items-center gap-md border-b border-outline-variant/30 bg-white">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-medium bg-primary-cta text-on-primary tabular-nums">
              {activeIndex}
            </span>
            <span className="text-[12px] font-label text-on-surface-variant">
              {t(roleI18nKey(active?.role ?? "content") as never)}
            </span>
            {active?.title && (
              <>
                <span className="opacity-30">·</span>
                <span className="text-[12px] text-on-surface truncate max-w-[300px]">
                  {active.title}
                </span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const idx = orderedSlides.findIndex((s) => s.index === activeIndex);
                if (idx > 0) setActiveIndex(orderedSlides[idx - 1].index);
              }}
              disabled={orderedSlides[0]?.index === activeIndex}
              className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed"
              title={t("slideDeck.prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[12px] font-label text-on-surface-variant tabular-nums">
              {orderedSlides.findIndex((s) => s.index === activeIndex) + 1} / {orderedSlides.length}
            </span>
            <button
              type="button"
              onClick={() => {
                const idx = orderedSlides.findIndex((s) => s.index === activeIndex);
                if (idx < orderedSlides.length - 1) setActiveIndex(orderedSlides[idx + 1].index);
              }}
              disabled={orderedSlides[orderedSlides.length - 1]?.index === activeIndex}
              className="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed"
              title={t("slideDeck.next")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-label bg-surface-container text-on-surface-variant tabular-nums">
              {ratio}
            </span>
            {/* 工具条:演示 + 下载 */}
            <div className="ml-2 pl-2 border-l border-outline-variant/40 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPresenting(true)}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-primary-cta text-on-primary text-[12px] font-medium hover:bg-primary-container transition-colors"
                title={t("slideDeck.presentMode")}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>演示</span>
              </button>
              <a
                href={`/api/tasks/${task.id}/export`}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-surface-container text-on-surface text-[12px] hover:bg-surface-container-high transition-colors"
                title={t("slideDeck.downloadZip")}
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载</span>
              </a>
            </div>
          </div>
        </header>

        {/* 主舞台 */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-md">
          {active && active.url ? (
            <SlideStage url={active.url} isHtml={active.isHtml} ratio={ratio} style={slideStyle} />
          ) : (
            <div className="text-on-surface-variant text-center">
              <ImageIcon className="w-12 h-12 mx-auto mb-sm opacity-30" />
              <p className="font-label text-label">{t("slideDeck.slideGenerating", { i: active?.index })}</p>
            </div>
          )}
        </div>

        {/* 底部演示者备注 — 真实编辑,localStorage 持久化(每页独立) */}
        <footer className="shrink-0 px-md py-2 border-t border-outline-variant/30 bg-white">
          <div className="text-[11px] font-label text-on-surface-variant/60 mb-1 flex items-center gap-2">
            <span>演示者备注</span>
            <span className="text-on-surface-variant/40">·</span>
            <span className="text-on-surface-variant/40">{t("slideDeck.slideN", { i: activeIndex })}</span>
            {notes[activeIndex]?.length ? (
              <span className="ml-auto text-on-surface-variant/40">
                {notes[activeIndex].length} 字
              </span>
            ) : null}
          </div>
          <textarea
            key={activeIndex}
            value={notes[activeIndex] ?? ""}
            onChange={(e) => setNote(activeIndex, e.target.value)}
            placeholder={t("slideDeck.notesPlaceholder")}
            rows={2}
            className="w-full resize-none rounded-md border border-outline-variant/40 bg-white px-2 py-1.5 text-[12px] leading-relaxed text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-cta/30 focus:border-primary-cta/40"
          />
        </footer>
      </section>

      {/* 右:缩略图 rail(对齐竞品 anygen,放在最右) */}
      {railCollapsed ? (
        <button
          type="button"
          onClick={() => setRailCollapsed(false)}
          className="shrink-0 w-7 h-full bg-white border-l border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40"
          aria-label={t("slideDeck.expandIndex")}
          title={t("slideDeck.expandIndex")}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      ) : (
        <aside className="w-[200px] shrink-0 border-l border-outline-variant/30 bg-white flex flex-col">
          {/* rail 顶部:+ 新建 + 折叠 */}
          <div className="shrink-0 px-2 py-2 flex items-center gap-1 border-b border-outline-variant/20">
            <button
              type="button"
              disabled
              title={t("slideDeck.newSlide")}
              className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md border border-dashed border-outline-variant/60 text-[11px] text-on-surface-variant hover:bg-surface-container/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" />
              新建幻灯片
            </button>
            <button
              type="button"
              onClick={() => setRailCollapsed(true)}
              className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container/40"
              aria-label={t("slideDeck.collapseIndex")}
              title={t("slideDeck.collapseIndex")}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* 缩略图列表(支持拖拽排序,本地 localStorage 持久化) */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {orderedSlides.map((s, position) => {
              const isActive = s.index === activeIndex;
              const isDragging = draggingIdx === position;
              const isDropTarget = dragOverIdx === position && draggingIdx !== position;
              return (
                <ThumbnailCard
                  key={s.index}
                  slide={s}
                  ratio={ratio}
                  style={slideStyle}
                  isActive={isActive}
                  onClick={() => setActiveIndex(s.index)}
                  draggable
                  isDragging={isDragging}
                  isDropTarget={isDropTarget}
                  onDragStart={(e) => {
                    setDraggingIdx(position);
                    e.dataTransfer.effectAllowed = "move";
                    // 隐藏默认拖拽残影 → 用更轻的视觉
                    e.dataTransfer.setData("text/plain", String(s.index));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIdx !== position) setDragOverIdx(position);
                  }}
                  onDragLeave={() => {
                    if (dragOverIdx === position) setDragOverIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingIdx === null) return;
                    moveSlide(draggingIdx, position);
                    setDraggingIdx(null);
                    setDragOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDraggingIdx(null);
                    setDragOverIdx(null);
                  }}
                />
              );
            })}
            {customOrder && (
              <button
                type="button"
                onClick={() => setCustomOrder(null)}
                className="mt-1 text-[11px] text-on-surface-variant hover:text-primary-cta py-1 transition-colors"
                title={t("slideDeck.resetOrder")}
              >
                ↺ 恢复原始顺序
              </button>
            )}
          </div>
        </aside>
      )}

      {/* 演示模式 overlay:全屏放映 + 进度条 + 键盘翻页 + Esc 退出 */}
      {presenting && active && (
        <PresentationOverlay
          active={active}
          ratio={ratio}
          style={slideStyle}
          position={orderedSlides.findIndex((s) => s.index === activeIndex) + 1}
          total={orderedSlides.length}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────── 演示模式(全屏放映) ───────────────────────

function PresentationOverlay({
  active,
  ratio,
  style,
  position,
  total,
  onClose,
}: {
  active: SlideRow;
  ratio: string;
  style: SlideStyle | null;
  position: number;
  total: number;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full h-full max-w-[min(100%,calc(100vh*16/9))] max-h-full">
          <SlideStage url={active.url ?? ""} isHtml={active.isHtml} ratio={ratio} style={style} />
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-between px-md py-2 bg-black/60 text-white/70 text-[11px]">
        <span className="opacity-70">{t("slideDeck.presentHint")}</span>
        <span className="tabular-nums">{position} / {total}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label={t("slideDeck.exitPresent")}
        title={t("slideDeck.exitPresent")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────── 缩略图卡(真实渲染) ───────────────────────

interface ThumbnailCardProps {
  slide: SlideRow;
  ratio: string;
  style: SlideStyle | null;
  isActive: boolean;
  onClick: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

function ThumbnailCard({
  slide,
  ratio,
  style,
  isActive,
  onClick,
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: ThumbnailCardProps) {
  const t = useTranslations();
  const aspectClass =
    ratio === "9:16"
      ? "aspect-[9/16]"
      : ratio === "1:1"
        ? "aspect-square"
        : ratio === "4:3"
          ? "aspect-[4/3]"
          : "aspect-[16/9]";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-stretch gap-1 text-left w-full transition-all ${
        isDragging ? "opacity-40" : ""
      } ${isDropTarget ? "ring-2 ring-primary-cta ring-offset-1 rounded-md" : ""}`}
      title={slide.title || `Slide ${slide.index}`}
    >
      {draggable && (
        <span
          className="shrink-0 w-3.5 pt-1.5 flex justify-center text-on-surface-variant/30 group-hover:text-on-surface-variant cursor-grab active:cursor-grabbing"
          aria-label={t("slideDeck.dragSort")}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 flex items-stretch gap-1.5 text-left"
      >
        <span
          className={`shrink-0 w-4 pt-1.5 text-center text-[10px] font-medium tabular-nums ${
            isActive ? "text-primary-cta" : "text-on-surface-variant/70"
          }`}
        >
          {slide.index}
        </span>
        <div
          className={`flex-1 min-w-0 ${aspectClass} rounded-md overflow-hidden bg-white border-2 transition-colors ${
            isActive
              ? "border-primary-cta shadow-md"
              : "border-outline-variant/40 group-hover:border-outline-variant"
          }`}
        >
          {slide.url ? (
            slide.isHtml ? (
              <ThumbnailHtmlPreview url={slide.url} ratio={ratio} style={style} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.url}
                alt={slide.title || `Slide ${slide.index}`}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-container-low">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-cta/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-cta" />
              </span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

// 把 ratio 字符串解析成参考画布大小(像素),作为 iframe 渲染基准
function ratioToBase(ratio: string): { w: number; h: number } {
  if (ratio === "9:16") return { w: 720, h: 1280 };
  if (ratio === "1:1") return { w: 1024, h: 1024 };
  if (ratio === "4:3") return { w: 1280, h: 960 };
  if (ratio === "3:4") return { w: 960, h: 1280 };
  if (ratio === "3:2") return { w: 1536, h: 1024 };
  return { w: 1280, h: 720 }; // 16:9 默认
}

/**
 * 把 iframe 锁定渲染在参考画布大小,然后用 ResizeObserver 监听外层容器,
 * 通过 transform: scale() 等比缩放到容器实际宽高。
 * 这样无论容器大小,slide 内部排版始终一致 — 跟 PowerPoint 的"缩放预览"一致。
 */
function ScaledHtmlIframe({
  html,
  ratio,
  title,
  interactive = true,
  style = null,
}: {
  html: string;
  ratio: string;
  title: string;
  interactive?: boolean;
  style?: SlideStyle | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const base = useMemo(() => ratioToBase(ratio), [ratio]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function recompute() {
      const w = el!.clientWidth;
      const h = el!.clientHeight;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / base.w, h / base.h);
      setScale(s);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [base.w, base.h]);

  return (
    <div
      ref={wrapRef}
      className={`w-full h-full relative overflow-hidden ${interactive ? "" : "pointer-events-none"}`}
    >
      <iframe
        srcDoc={wrapHtml(html, style, ratio)}
        title={title}
        sandbox="allow-same-origin"
        className={`border-0 absolute top-0 left-0 ${interactive ? "" : "pointer-events-none"}`}
        style={{
          width: `${base.w}px`,
          height: `${base.h}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

function ThumbnailHtmlPreview({
  url,
  ratio,
  style,
}: {
  url: string;
  ratio: string;
  style?: SlideStyle | null;
}) {
  const html = useMemo(() => decodeDataUrl(url), [url]);
  return (
    <ScaledHtmlIframe
      html={html}
      ratio={ratio}
      title="slide thumbnail"
      interactive={false}
      style={style}
    />
  );
}

function roleI18nKey(role: string): string {
  switch (role) {
    case "cover":
      return "taskChat.roles.cover";
    case "agenda":
      return "taskChat.roles.agenda";
    case "section_divider":
      return "taskChat.roles.sectionDivider";
    case "content":
      return "taskChat.roles.content";
    case "closing":
      return "taskChat.roles.closing";
    default:
      return role;
  }
}

function SlideStage({
  url,
  isHtml,
  ratio,
  style = null,
}: {
  url: string;
  isHtml: boolean;
  ratio: string;
  style?: SlideStyle | null;
}) {
  // 把 ratio "16:9" → CSS aspectRatio "16 / 9";浏览器会按 width:100% + maxHeight:100%
  // 自动收缩到能容纳的尺寸,从而在父级 flex 中央居中并保持比例。
  const [aw, ah] = ratio.split(":").map((n) => Number.parseInt(n, 10) || 1);
  const cardStyle: React.CSSProperties = {
    aspectRatio: `${aw} / ${ah}`,
    width: "100%",
    maxHeight: "100%",
    maxWidth: "100%",
  };

  // T2-58:url 为空 = 还在生成,显示骨架 + shimmer,而不是空白 / 破图
  if (!url) {
    return (
      <div
        className="bg-gradient-to-br from-surface-container to-surface-container-high shadow-lg rounded-lg overflow-hidden mx-auto relative border border-outline-variant/40"
        style={cardStyle}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.8s_infinite] -translate-x-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant">
          <ImageIcon className="w-16 h-16 opacity-30 mb-2" />
          <p className="text-[14px] font-medium opacity-60">…</p>
        </div>
      </div>
    );
  }

  if (isHtml) {
    const html = decodeDataUrl(url);
    return (
      <div
        className="bg-white shadow-lg rounded-lg overflow-hidden mx-auto"
        style={cardStyle}
      >
        <ScaledHtmlIframe
          html={html}
          ratio={ratio}
          title="Slide HTML"
          style={style}
        />
      </div>
    );
  }

  return (
    <div
      className="bg-white shadow-lg rounded-lg overflow-hidden mx-auto"
      style={cardStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Slide" className="w-full h-full object-contain" />
    </div>
  );
}

function decodeDataUrl(dataUrl: string): string {
  // data:text/html;base64,XXX
  const m = dataUrl.match(/^data:text\/html(?:;charset=[^;]+)?;base64,(.+)$/);
  if (m) {
    try {
      // atob 只解 latin1,中文会乱码;要走 UTF-8 → TextDecoder
      const binary = atob(m[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return "";
    }
  }
  return "";
}

function wrapHtml(
  htmlFragment: string,
  style: SlideStyle | null,
  ratio: string,
): string {
  // M5+ 重做(2026-05-03 T2-31):iframe 内 base CSS 按风格动态生成
  // 不再写死通用 CSS,style.colors / fonts / scale 真的吃到视觉里
  // fallback 风格(没传 style):用 modern_pro 默认值,不会崩
  const safeStyle = style ?? FALLBACK_STYLE;
  const baseCss = buildBaseCss(safeStyle, ratio);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>${baseCss}</style>
</head><body>${htmlFragment}</body></html>`;
}

const FALLBACK_STYLE: SlideStyle = {
  id: "modern_pro",
  name: "fallback",
  emoji: "",
  oneLineDesc: "",
  supports: ["L1"],
  colors: {
    primary: "#FF5722",
    secondary: "#1a1a1a",
    accent: "#FF8A65",
    bg: "#0d0d0d",
    text: "#ffffff",
    textSecondary: "#a0a0a0",
  },
  fonts: {
    heading: '"Archivo Black", "Noto Sans SC", system-ui, sans-serif',
    body: '"Space Grotesk", "Noto Sans SC", system-ui, sans-serif',
  },
  scale: { h1: 4.5, h2: 2.5, h3: 1.6, body: 1.0, caption: 0.85 },
  compatibleLayouts: [],
  defaultBackground: { type: "solid" },
  emojiPolicy: "sparse",
  l2PromptBase: { styleAdjectives: "", colorPalette: "", composition: "", texture: "", negativeCues: "" },
  defaultRatio: "16:9",
  status: "complete",
};

// ─────────────────────── L1 模板填充模式专用 view ───────────────────────
// 整个 deck 是一个完整 HTML(单 task_file,带内置翻页器),用 iframe 全屏渲染。
// 32 个外部模板的 keydown handler 不一致(部分只支持 ←→,部分 ←→↑↓ 都行)。
// 本组件用 srcdoc + same-origin iframe 让 parent 拦截 ↑↓ 转发为 ←→,
// 并提供显式上一张/下一张/页码 按钮替代依赖键盘的方式。

function L1TemplateDeckView({
  task,
  images,
  ratio,
  t,
}: {
  task: TaskApiResponse;
  images: StreamedImage[];
  ratio: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState<number | null>(null);
  // 缩略图标题列(从 deck.html DOM 解析每个 section 的标题文字,用作 nav rail)
  const [sectionTitles, setSectionTitles] = useState<string[]>([]);
  // 单页修改 modal 状态
  const [refinePageNo, setRefinePageNo] = useState<number | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  // Phase 6:元素级标注修改模式开关
  const [annotationMode, setAnnotationMode] = useState(false);

  const deckUrl = images[0]?.url ?? "";

  // base64 → HTML 字符串(用 srcdoc 而不是 src=data:URL,
  // data: URL 是 null origin,parent 没法访问 contentDocument 来 dispatch event)
  // Phase 6:annotationMode 激活时把 inject script 拼进去(让 iframe 内监听 click + postMessage)
  const html = useMemo(() => {
    const m = deckUrl.match(/^data:text\/html;base64,(.+)$/);
    if (!m) return "";
    let raw = "";
    try {
      raw = decodeURIComponent(escape(atob(m[1])));
    } catch {
      return "";
    }
    if (!annotationMode) return raw;
    const inject = buildAnnotationInjectScript();
    return raw.includes("</body>")
      ? raw.replace("</body>", `${inject}\n</body>`)
      : raw + inject;
  }, [deckUrl, annotationMode]);

  // 给每个缩略图构造 srcdoc:复制完整 deck HTML,自动跳到目标 section,屏蔽交互
  const buildThumbHtml = useCallback(
    (target: number): string => {
      if (!html) return "";
      // 注入 JS:等模板初始化后翻 N 次 ←,模拟跳到目标 slide,然后冻结
      const inject = `
<script>
(function(){
  var target = ${target};
  setTimeout(function(){
    try {
      // 翻 (target - 1) 次 ArrowRight 让模板跳到目标 slide
      for (var i = 0; i < target - 1; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', code: 'ArrowRight', bubbles: true}));
      }
    } catch (e) {}
    // 冻结:屏蔽鼠标指针 + 隐藏 scrollbar(缩略图静态展示)
    document.documentElement.style.pointerEvents = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';
    document.body.style.overflow = 'hidden';
  }, 80);
})();
</script>`;
      // 优先放在 </body> 前;没有 </body> 就追加到结尾
      return html.includes("</body>")
        ? html.replace("</body>", `${inject}\n</body>`)
        : html + inject;
    },
    [html],
  );

  // 拦截 keydown,把 ↑↓ 转发为 ←→ 给 iframe(覆盖只支持 ←→ 的模板)
  // 同时跟踪 currentSlide(本地维护,模板自身的 currentSlide 各异不可统一读)
  const dispatchKey = useCallback(
    (key: "ArrowLeft" | "ArrowRight") => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument || !iframe.contentWindow) return;
      try {
        iframe.contentDocument.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            code: key,
            bubbles: true,
            cancelable: true,
          }),
        );
      } catch {
        // contentDocument 跨 origin / sandbox 限制 — 静默忽略
      }
    },
    [],
  );

  const goPrev = useCallback(() => {
    if (currentSlide <= 1) return;
    setCurrentSlide((n) => n - 1);
    dispatchKey("ArrowLeft");
  }, [currentSlide, dispatchKey]);

  const goNext = useCallback(() => {
    if (totalSlides && currentSlide >= totalSlides) return;
    setCurrentSlide((n) => n + 1);
    dispatchKey("ArrowRight");
  }, [currentSlide, totalSlides, dispatchKey]);

  // 跳转到指定 slide(模拟 N 次 ←→ keydown,同时本地状态同步)
  const goTo = useCallback(
    (target: number) => {
      const delta = target - currentSlide;
      if (delta === 0) return;
      const key = delta > 0 ? "ArrowRight" : "ArrowLeft";
      for (let i = 0; i < Math.abs(delta); i++) {
        dispatchKey(key);
      }
      setCurrentSlide(target);
    },
    [currentSlide, dispatchKey],
  );

  // 全局 keydown:↑↓ 转发为 ←→,← / → 也维护本地 currentSlide
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      // textarea / input 内不拦截(避免影响输入)
      if (tag === "textarea" || tag === "input") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // iframe load 后:数 .slide section 数量 + 提取每张的标题文字作为缩略图 nav 标签
  const onIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    try {
      const sections = Array.from(
        iframe.contentDocument.querySelectorAll(
          "section.slide, .slide:not(.slides):not(.slide-deck), [data-slide]",
        ),
      );
      if (sections.length > 0) {
        setTotalSlides(sections.length);
        setSectionTitles(
          sections.map((s, i) => {
            // 优先 h1/h2/h3 → .title/.headline/.h-hero/.h-xl → fallback 第 1 行 textContent
            const heading = s.querySelector(
              "h1, h2, h3, .title, .headline, .h-hero, .h-xl, .h-md, .hero, .lead",
            ) as HTMLElement | null;
            const raw =
              heading?.textContent?.trim() ||
              (s as HTMLElement).textContent?.trim().split("\n")[0] ||
              "";
            return raw.slice(0, 28) || `第 ${i + 1} 页`;
          }),
        );
      }
    } catch {
      // 跨 origin 静默
    }
  }, []);

  const presentDeck = () => {
    try {
      const w = window.open("", "_blank");
      if (w && html) {
        w.document.write(html);
        w.document.close();
      }
    } catch {
      window.open(deckUrl, "_blank");
    }
  };

  // 单页修改:提交 instruction → API → 成功后 reload 让 SSE 拿新 deck
  const submitRefine = async () => {
    if (!refinePageNo || !refineInstruction.trim() || refining) return;
    setRefining(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/refine-slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNo: refinePageNo,
          instruction: refineInstruction.trim(),
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      const isJson = ct.includes("application/json");
      if (!res.ok) {
        const err = isJson ? await res.json().catch(() => ({})) : {};
        const msg = (err as { error?: string }).error ?? `HTTP ${res.status}`;
        window.alert(`修改失败:${msg}`);
        return;
      }
      // 成功 → 关 modal + reload(SSE 会拉新 task_file)
      setRefinePageNo(null);
      setRefineInstruction("");
      // 简单粗暴 reload,让 SSE 重新拉最新 deck
      window.location.reload();
    } catch (e) {
      window.alert(`修改失败:${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-main-bg overflow-hidden">
      <header className="shrink-0 h-10 px-md flex items-center gap-md border-b border-outline-variant/30 bg-white">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-medium bg-primary-cta text-on-primary">
            ★
          </span>
          <span className="text-[12px] font-label text-on-surface">
            模板 deck · {ratio}
          </span>
          <span className="opacity-30">·</span>
          <span className="text-[12px] font-label text-on-surface-variant">
            {t("slideDeck.deckNavHint")}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 显式上一张 / 下一张 / 页码 — 不依赖键盘 */}
          <div className="inline-flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentSlide <= 1}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t("slideDeck.prev")}
              aria-label={t("slideDeck.prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[12px] font-label text-on-surface tabular-nums min-w-[44px] text-center">
              {currentSlide}
              {totalSlides ? ` / ${totalSlides}` : ""}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!!totalSlides && currentSlide >= totalSlides}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t("slideDeck.next")}
              aria-label={t("slideDeck.next")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {/* Phase 6:标注修改模式 toggle(对标 AnyGen "click any element to edit") */}
          {task.status === "done" && task.templateId && (
            <button
              type="button"
              onClick={() => setAnnotationMode((v) => !v)}
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium transition-colors ${
                annotationMode
                  ? "bg-primary-cta text-on-primary"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-high"
              }`}
              title={annotationMode ? t("annotation.toolbarTooltipOn") : t("annotation.toolbarTooltipOff")}
            >
              <span>{annotationMode ? t("annotation.toolbarToggleOn") : t("annotation.toolbarToggleOff")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={presentDeck}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-primary-cta text-on-primary text-[12px] font-medium hover:bg-primary-container transition-colors"
            title={t("slideDeck.openFullscreen")}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>演示</span>
          </button>
          {/* 2026-05-17 PR41:下载分 3 格式 — HTML / PPTX / PDF
              PPTX/PDF 走 playwright 截图嵌(图片版),后续 Phase 2 续做 native PPTX */}
          <div className="inline-flex items-center rounded-md bg-surface-container overflow-hidden">
            <a
              href={`/api/tasks/${task.id}/export?format=html`}
              className="inline-flex items-center gap-1 h-7 px-2 text-on-surface text-[12px] hover:bg-surface-container-high transition-colors"
              title="下载 HTML(单文件,浏览器打开)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HTML</span>
            </a>
            <div className="w-px h-4 bg-outline-variant/40" />
            <a
              href={`/api/tasks/${task.id}/export?format=pptx`}
              className="inline-flex items-center h-7 px-2 text-on-surface text-[12px] hover:bg-surface-container-high transition-colors"
              title="下载 PPTX(图片版,PowerPoint 打开 ≈ 30-60s)"
            >
              PPTX
            </a>
            <div className="w-px h-4 bg-outline-variant/40" />
            <a
              href={`/api/tasks/${task.id}/export?format=pdf`}
              className="inline-flex items-center h-7 px-2 text-on-surface text-[12px] hover:bg-surface-container-high transition-colors"
              title="下载 PDF(适合分享 / 投影 ≈ 5-10s)"
            >
              PDF
            </a>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden bg-black flex">
        {/* 中央主预览(1fr) */}
        <div className="flex-1 min-w-0">
          <iframe
            ref={iframeRef}
            // srcdoc 让 iframe 跟 parent 同源,parent 才能用 contentDocument.dispatchEvent
            srcDoc={html}
            onLoad={onIframeLoad}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
            title="L1 Template Deck"
          />
        </div>
        {/* 右侧缩略图列(每张是迷你 iframe,自动跳到目标 section)*/}
        {sectionTitles.length > 1 && (
          <aside className="w-[200px] shrink-0 border-l border-outline-variant/20 bg-white overflow-y-auto flex flex-col gap-2 p-2">
            {sectionTitles.map((title, i) => {
              const slideNum = i + 1;
              const isActive = slideNum === currentSlide;
              return (
                <button
                  key={`${slideNum}-${title}`}
                  type="button"
                  onClick={() => goTo(slideNum)}
                  title={`${slideNum}. ${title}`}
                  className={`shrink-0 group flex flex-col gap-1 rounded-md overflow-hidden border transition-all text-left ${
                    isActive
                      ? "border-primary-cta shadow-[0_0_0_2px_rgba(201,107,53,0.2)]"
                      : "border-outline-variant/30 hover:border-primary-cta/50"
                  }`}
                >
                  {/* 真缩略图:迷你 iframe 加载完整 deck.html 自动跳到第 N 页 */}
                  <div
                    className="relative w-full bg-black overflow-hidden"
                    style={{ aspectRatio: ratio.replace(":", " / ") || "16 / 9" }}
                  >
                    <iframe
                      key={`thumb-${slideNum}-${html.length}`}
                      srcDoc={buildThumbHtml(slideNum)}
                      sandbox="allow-scripts allow-same-origin"
                      // scale 缩小到 ~16% (1920×1080 → 192×108) 略大于容器,容器 overflow:hidden
                      className="absolute top-0 left-0 origin-top-left border-0 pointer-events-none"
                      style={{
                        width: "1920px",
                        height: "1080px",
                        transform: "scale(0.094)",
                      }}
                      title={`Thumbnail ${slideNum}`}
                      tabIndex={-1}
                      aria-hidden
                      loading="lazy"
                    />
                  </div>
                  <div className="px-2 py-1 flex items-center gap-1.5">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-medium tabular-nums ${
                        isActive
                          ? "bg-primary-cta text-on-primary"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {slideNum}
                    </span>
                    <span className="truncate flex-1 text-[11px] text-on-surface font-label">
                      {title}
                    </span>
                    {/* 改这页 — 仅 task 完成 + 是模板填充模式时显示 */}
                    {task.templateId && task.status === "done" && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefinePageNo(slideNum);
                          setRefineInstruction("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setRefinePageNo(slideNum);
                            setRefineInstruction("");
                          }
                        }}
                        className="shrink-0 w-5 h-5 inline-flex items-center justify-center rounded text-[10px] text-on-surface-variant hover:bg-primary-cta/10 hover:text-primary-cta cursor-pointer"
                        title="用 AI 修改这一页"
                        aria-label="用 AI 修改这一页"
                      >
                        ✎
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </aside>
        )}
      </div>

      {/* 单页修改 Modal */}
      {refinePageNo !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !refining && setRefinePageNo(null)}
        >
          <div
            className="relative w-[min(92vw,560px)] rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-md py-3 border-b border-outline-variant/30 flex items-center justify-between">
              <h2 className="font-h3 text-[15px] text-on-surface">
                修改第 {refinePageNo} 页
              </h2>
              <button
                type="button"
                onClick={() => !refining && setRefinePageNo(null)}
                disabled={refining}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="px-md py-md flex flex-col gap-2">
              <p className="text-[12px] text-on-surface-variant">
                用文字描述这一页要怎么改,AI 会重写这一页内容(其他页不受影响)。例如:
              </p>
              <p className="text-[11px] text-on-surface-variant/80 leading-relaxed">
                · 把标题改成「2026 半年度战略」<br />
                · 把第一个要点换成关于产品定位的内容<br />
                · 加上具体数据:用户留存率 78% / 月活增长 23%
              </p>
              <textarea
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                disabled={refining}
                placeholder="描述要怎么改..."
                rows={4}
                className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-primary-cta resize-none disabled:opacity-50"
              />
            </div>
            <footer className="px-md py-3 border-t border-outline-variant/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !refining && setRefinePageNo(null)}
                disabled={refining}
                className="h-8 px-3 rounded-md text-[12px] text-on-surface hover:bg-surface-container disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitRefine}
                disabled={refining || !refineInstruction.trim()}
                className="h-8 px-3 rounded-md bg-primary-cta text-on-primary text-[12px] font-medium hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {refining ? "AI 改写中…" : "用 AI 改这一页"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Phase 6:元素级标注修改的浮层 + 待应用清单 */}
      <AnnotationOverlay
        taskId={task.id}
        annotationMode={annotationMode}
        setAnnotationMode={setAnnotationMode}
        onApplied={() => {
          // 应用成功后简单 reload(SSE 会拉新 task_file 的最新 pageVersion)
          // 跟 submitRefine 同 pattern
          window.location.reload();
        }}
      />
    </div>
  );
}
