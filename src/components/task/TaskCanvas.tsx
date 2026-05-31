// SPEC §2.1 Step 8 + §2.8 — 自由画布(任务页右栏)
// M1.8c+d:加单卡拖拽 / 选中态 / 右键菜单(下载单张/选中)

"use client";

import { Download, ImageIcon, Layers, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Canvas, type CanvasCardData, type CanvasLayoutMap } from "./Canvas";
import type { StreamedImage } from "./useTaskStream";
import type { TaskRecord } from "@/lib/tasks/types";
import type { AnalyzeOutput } from "@/lib/cards/agents";

type TaskApiResponse = Omit<TaskRecord, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  canvasLayout?: CanvasLayoutMap | null;
};

type Props = {
  task: TaskApiResponse;
  images?: StreamedImage[];
  outline?: AnalyzeOutput | null;
  /** M5+:project workspace 模式 — 启用后画布 ID 用 taskId-pageNo 防冲突,
   *  layout PATCH 走 /api/projects/[id] 而非 /api/tasks/[id]/layout */
  projectId?: string;
};

const CARD_DIM_BY_RATIO: Record<string, { w: number; h: number }> = {
  "3:4": { w: 480, h: 640 },
  "4:5": { w: 480, h: 600 },
  "1:1": { w: 480, h: 480 },
  "9:16": { w: 480, h: 853 },
  "16:9": { w: 854, h: 480 },
  "4:3": { w: 640, h: 480 },
};
const GRID_GAP = 24;

/**
 * 根据卡数挑选最平衡的列数,避免出现"末列空一半"的尴尬:
 *   1 张  → 1 列
 *   2-4 张 → 2 列
 *   5-9 张 → 3 列(5: 3+2;6: 3+3;7-9: 3-3-3)
 *   10+   → 4 列
 */
function pickColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

function defaultCount(task: TaskApiResponse): number {
  if (task.mode === "image") return task.imageCount ?? 1;
  if (task.mode === "slides") return 8;
  return 6;
}

function expectedCount(
  task: TaskApiResponse,
  images: StreamedImage[],
  outline: AnalyzeOutput | null | undefined,
): number {
  // image 模式只看 task.imageCount,不走 outline 推断(image 没大纲)
  if (task.mode === "image") return task.imageCount ?? 1;
  if (outline?.cards && Array.isArray(outline.cards)) return outline.cards.length;
  if (outline?.recommended_count) return outline.recommended_count;
  const a = task.analyzeResult as
    | { cards?: unknown[]; recommended_count?: number }
    | null;
  if (a?.cards && Array.isArray(a.cards)) return a.cards.length;
  if (typeof a?.recommended_count === "number") return a.recommended_count;
  if (images.length > 0) return Math.max(images.length, defaultCount(task));
  return defaultCount(task);
}

interface ContextMenuState {
  x: number;
  y: number;
  cardId: string;
}

export function TaskCanvas({ task, images = [], outline, projectId }: Props) {
  const t = useTranslations();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  // 关闭右键菜单(任意点击 / Esc)
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", (e) => {
      // 在 menu 之外的右键也关掉
      if (!(e.target as Element)?.closest?.("[data-canvas-context-menu]")) {
        setMenu(null);
      }
    });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const cards = useMemo<CanvasCardData[]>(() => {
    const dim = CARD_DIM_BY_RATIO[task.ratio] ?? CARD_DIM_BY_RATIO["3:4"];
    // project 模式:旧任务图保留 + 当前任务正在跑时给未完成 page 补骨架占位
    // (T2-58:之前 project 模式只渲染实图,生成中右侧画布全空白让人以为卡死)
    if (projectId) {
      const isInProgress =
        task.status === "analyzing" ||
        task.status === "outlining" ||
        task.status === "confirming" ||
        task.status === "generating";

      // 拆分:当前任务的图 vs 历史已完成任务的图
      const latestTaskImages = images.filter(
        (i) => (i.taskId ?? task.id) === task.id,
      );
      const olderImages = images.filter(
        (i) => (i.taskId ?? task.id) !== task.id,
      );

      // 当前任务期望出几张:跑中按 outline / imageCount 推算;已完成按实际数
      const latestExpected = isInProgress
        ? expectedCount(task, latestTaskImages, outline)
        : latestTaskImages.length;
      const latestSlotCount = Math.max(latestExpected, latestTaskImages.length);

      const totalCount = olderImages.length + latestSlotCount;
      const columns = pickColumns(totalCount);

      const list: CanvasCardData[] = [];
      let i = 0;

      // ① 历史已完成的图(其他 task)
      for (const img of olderImages) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const cardId = `${img.taskId ?? task.id}-${img.pageNo}`;
        list.push({
          id: cardId,
          x: col * (dim.w + GRID_GAP),
          y: row * (dim.h + GRID_GAP),
          width: dim.w,
          height: dim.h,
          interactive: true,
          render: () => (
            <RealCard
              image={img}
              taskId={img.taskId ?? task.id}
              showLabel={false}
            />
          ),
        });
        i++;
      }

      // ② 当前任务:实图 by pageNo + 缺失 page 用骨架占位(T2-58)
      const latestByPage = new Map<number, StreamedImage>();
      for (const img of latestTaskImages) latestByPage.set(img.pageNo, img);
      for (let p = 1; p <= latestSlotCount; p++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const img = latestByPage.get(p);
        list.push({
          id: img
            ? `${img.taskId ?? task.id}-${img.pageNo}`
            : `placeholder-${task.id}-${p}`,
          x: col * (dim.w + GRID_GAP),
          y: row * (dim.h + GRID_GAP),
          width: dim.w,
          height: dim.h,
          interactive: !!img,
          render: () =>
            img ? (
              <RealCard
                image={img}
                taskId={img.taskId ?? task.id}
                showLabel={false}
              />
            ) : (
              <PlaceholderCard index={p} task={task} />
            ),
        });
        i++;
      }
      return list;
    }
    // 单 task 模式(legacy):占位卡 + 实图
    const count = expectedCount(task, images, outline);
    const columns = pickColumns(count);
    const byPage = new Map<number, StreamedImage>();
    for (const img of images) byPage.set(img.pageNo, img);

    const list: CanvasCardData[] = [];
    for (let i = 0; i < count; i++) {
      const pageNo = i + 1;
      const col = i % columns;
      const row = Math.floor(i / columns);
      const img = byPage.get(pageNo);
      list.push({
        id: `card-${pageNo}`,
        x: col * (dim.w + GRID_GAP),
        y: row * (dim.h + GRID_GAP),
        width: dim.w,
        height: dim.h,
        interactive: !!img,
        render: () =>
          img ? (
            <RealCard
              image={img}
              taskId={task.id}
              showLabel={false}
            />
          ) : (
            <PlaceholderCard index={pageNo} task={task} />
          ),
      });
    }
    return list;
  }, [task, images, outline, projectId]);

  // 卡 id → pageNo 映射(用于下载导出)
  const cardPageNo = (id: string): number => Number(id.replace(/^card-/, ""));

  const handleCardContextMenu = useCallback(
    (cardId: string, e: React.MouseEvent) => {
      setMenu({ x: e.clientX, y: e.clientY, cardId });
    },
    [],
  );

  const downloadOne = useCallback(
    (cardId: string) => {
      const page = cardPageNo(cardId);
      window.location.href = `/api/tasks/${task.id}/export?pages=${page}`;
      setMenu(null);
    },
    [task.id],
  );

  const downloadSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const pages = Array.from(selectedIds).map(cardPageNo).sort((a, b) => a - b);
    window.location.href = `/api/tasks/${task.id}/export?pages=${pages.join(",")}`;
    setMenu(null);
  }, [selectedIds, task.id]);

  const downloadAll = useCallback(() => {
    window.location.href = `/api/tasks/${task.id}/export`;
    setMenu(null);
  }, [task.id]);

  const regenerateOne = useCallback(
    async (cardId: string) => {
      const page = cardPageNo(cardId);
      setMenu(null);
      try {
        const res = await fetch(
          `/api/tasks/${task.id}/cards/${page}/regenerate`,
          { method: "POST" },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        // SSE 自动会推新版本图替换占位,无需手动刷新
      } catch (err) {
        console.error("[regenerate]", err);
        alert(
          err instanceof Error ? `${t("taskCanvas.regenFailed")}: ${err.message}` : t("taskCanvas.regenFailed"),
        );
      }
    },
    [task.id],
  );

  const selectAll = useCallback(() => {
    const all = new Set<string>();
    for (const c of cards) if (c.interactive) all.add(c.id);
    setSelectedIds(all);
    setMenu(null);
  }, [cards]);

  if (task.mode === "slides") {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-on-surface-variant text-center max-w-[420px] px-md">
          <ImageIcon className="w-12 h-12 mx-auto mb-md opacity-40" />
          <p className="font-h3 text-h3 mb-sm">{t("taskCanvas.slidesPreviewWip")}</p>
          <p className="font-label text-label">{t("taskCanvas.slidesPreviewDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas
        cards={cards}
        autoFit
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onCardContextMenu={handleCardContextMenu}
        initialLayout={task.canvasLayout ?? undefined}
        onLayoutChange={(layout) => {
          // M5+:project 模式 → PATCH project.canvas_state(覆盖 task layout)
          // 单 task 模式 → 原 task layout endpoint
          if (projectId) {
            fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                canvasState: {
                  positions: layout.positions ?? {},
                  sizes: layout.sizes ?? {},
                },
              }),
            }).catch((e) =>
              console.error("[project canvasState PATCH]", e),
            );
          } else {
            fetch(`/api/tasks/${task.id}/layout`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(layout),
            }).catch((e) =>
              console.error("[layout PATCH]", e),
            );
          }
        }}
      />

      {/* 选中态浮条:右下角 zoom 控件之上 */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-[64px] right-md flex items-center gap-2 bg-on-surface text-white rounded-full shadow-lg px-3 py-1.5 text-[12px] font-label">
          <Layers className="w-3.5 h-3.5" />
          <span>{t("taskCanvas.selectedCount", { count: selectedIds.size })}</span>
          <button
            type="button"
            onClick={downloadSelected}
            className="ml-1 px-2 py-0.5 rounded-full bg-primary-cta hover:bg-primary-container transition-colors"
            title={t("taskCanvas.downloadSelected")}
          >
            ⬇ {t("taskCanvas.downloadSelected")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="opacity-70 hover:opacity-100"
            title={t("taskCanvas.clearSelection")}
          >
            ✕
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {menu && (
        <div
          data-canvas-context-menu
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 min-w-[180px] bg-white border border-outline-variant/40 rounded-lg shadow-xl py-1 text-[13px] font-label"
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            icon={<Download className="w-3.5 h-3.5" />}
            label={t("taskCanvas.downloadOne")}
            onClick={() => downloadOne(menu.cardId)}
          />
          {selectedIds.size > 1 && selectedIds.has(menu.cardId) && (
            <MenuItem
              icon={<Download className="w-3.5 h-3.5" />}
              label={t("taskCanvas.downloadSelectedCount", { count: selectedIds.size })}
              onClick={downloadSelected}
            />
          )}
          <MenuItem
            icon={<Download className="w-3.5 h-3.5" />}
            label={t("taskCanvas.downloadAll")}
            onClick={downloadAll}
          />
          <div className="h-px bg-outline-variant/40 my-1" />
          <MenuItem
            icon={<Layers className="w-3.5 h-3.5" />}
            label={t("taskCanvas.selectAll")}
            onClick={selectAll}
          />
          {task.mode !== "cards" && (
            <>
              <div className="h-px bg-outline-variant/40 my-1" />
              <MenuItem
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                label={t("taskCanvas.regenOne")}
                onClick={() => regenerateOne(menu.cardId)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="text-on-surface-variant">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function RealCard({
  image,
  taskId,
  showLabel = true,
}: {
  image: StreamedImage;
  taskId: string;
  showLabel?: boolean;
}) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden relative bg-surface-container border border-outline-variant/40 group">
      {showLabel && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-on-surface/70 text-white text-[11px] font-mono z-10 pointer-events-none">
          {image.pageNo}
          {image.role ? ` · ${image.role}` : ""}
        </div>
      )}
      {/* 右上角浮动下载按钮 — 单张直接下 PNG */}
      <a
        href={`/api/tasks/${taskId}/export?pages=${image.pageNo}`}
        download
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-on-surface/85 hover:bg-on-surface text-white flex items-center justify-center shadow-lg transition-colors"
        title="下载 PNG"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3v12M5 10l7 7 7-7M5 21h14" />
        </svg>
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={`第 ${image.pageNo} 张`}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover pointer-events-none"
      />
    </div>
  );
}

function PlaceholderCard({
  index,
  task,
}: {
  index: number;
  task: TaskApiResponse;
}) {
  const filename = `${task.slug}-${index}-1.png`;
  const isImageMode = task.mode === "image";
  return (
    <div className="w-full h-full rounded-xl bg-gradient-to-br from-surface-container to-surface-container-high border border-outline-variant/40 overflow-hidden relative pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.8s_infinite] -translate-x-full" />
      {!isImageMode && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-on-surface/70 text-white text-[11px] font-mono z-10">
          {filename}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant">
        <ImageIcon className="w-12 h-12 opacity-30 mb-sm" />
        {isImageMode ? (
          <p className="text-label font-label opacity-50">生成中…</p>
        ) : (
          <>
            <p className="text-h3 font-h3 opacity-60">第 {index} 张</p>
            <p className="text-label font-label opacity-40 mt-1">等待生成…</p>
          </>
        )}
      </div>
    </div>
  );
}
