// SPEC §2.8.2 / §2.8.3 — 自由画布核心
//
// 已实现:
//   - 拖空白 → pan(画布平移)
//   - 滚轮 → zoom(以鼠标为中心,0.1x ~ 4x)
//   - 双击空白 → fit-all
//   - Cmd+0 / Cmd+= / Cmd+- 键盘快捷键
//   - 卡片绝对定位(按 §2.8.6 初始布局算法 横向网格)
//   - **单卡拖拽**(SPEC §2.8.3 项 5):按住卡片拖动调整位置,本地 state 持久化(刷新丢失,M2 持久化到 task_versions.canvas_layout)
//   - **选中态**(SPEC §2.8.3 项 1):单击选 / Cmd+click 多选 / Esc 清空 / 拖空白清空
//   - **右键菜单 hook**(SPEC §2.8.3 项 8):透传 onCardContextMenu(id, event) 给 caller
//
// 未做(留 M2):
//   - 卡片右下角缩放把手(项 6)
//   - hover loupe(项 7)
//   - 圈选(框选多张)
//   - 全屏对比模态(项 4)
//   - canvas_layout 持久化(§2.8.7)

"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

export interface CanvasCardData {
  id: string;
  /** 画布坐标系内位置(左上角)*/
  x: number;
  y: number;
  width: number;
  height: number;
  /** 渲染内容 */
  render: () => React.ReactNode;
  /** 是否参与选中 / 拖拽(占位卡可设 false) */
  interactive?: boolean;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_DELTA_RATE = 0.001;
const FIT_PADDING = 64;

type Pan = { x: number; y: number };
type CardPos = { x: number; y: number };
type CardSize = { w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";

const MIN_CARD_W = 120;
const MIN_CARD_H = 120;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function getCardsBBox(cards: CanvasCardData[], overrides: Map<string, CardPos>) {
  if (cards.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of cards) {
    const ov = overrides.get(c.id);
    const x = ov ? ov.x : c.x;
    const y = ov ? ov.y : c.y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + c.width);
    maxY = Math.max(maxY, y + c.height);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export interface CanvasLayoutMap {
  /** card id → 位置 + 尺寸覆盖。仅含被用户改过的卡 */
  positions?: Record<string, { x: number; y: number }>;
  sizes?: Record<string, { w: number; h: number }>;
}

type Props = {
  cards: CanvasCardData[];
  /** 初始 fit-all */
  autoFit?: boolean;
  className?: string;
  /** 选中态回调(单/多选) */
  selectedIds?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  /** 右键单卡时触发,caller 弹菜单 */
  onCardContextMenu?: (id: string, e: React.MouseEvent) => void;
  /** M2.6:从 DB 加载的初始 layout(刷新时恢复) */
  initialLayout?: CanvasLayoutMap;
  /** M2.6:用户拖拽 / resize 后触发(caller debounce 后 PATCH 后端) */
  onLayoutChange?: (layout: CanvasLayoutMap) => void;
};

export function Canvas({
  cards,
  autoFit = true,
  className = "",
  selectedIds,
  onSelectionChange,
  onCardContextMenu,
  initialLayout,
  onLayoutChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const fittedOnce = useRef(false);

  // 单卡位置覆盖(用户拖拽后本地 state)— M2.6 初始从 initialLayout 加载
  const [posOverrides, setPosOverrides] = useState<Map<string, CardPos>>(() => {
    const m = new Map<string, CardPos>();
    if (initialLayout?.positions) {
      for (const [id, p] of Object.entries(initialLayout.positions)) m.set(id, p);
    }
    return m;
  });
  // 单卡尺寸覆盖(4 角拖拽 resize)
  const [sizeOverrides, setSizeOverrides] = useState<Map<string, CardSize>>(() => {
    const m = new Map<string, CardSize>();
    if (initialLayout?.sizes) {
      for (const [id, s] of Object.entries(initialLayout.sizes)) m.set(id, s);
    }
    return m;
  });

  // M2.6:posOverrides / sizeOverrides 变化时 debounce 通知 caller(后者 PATCH 后端)
  const onLayoutChangeRef = useRef(onLayoutChange);
  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange;
  }, [onLayoutChange]);
  useEffect(() => {
    if (!onLayoutChangeRef.current) return;
    if (posOverrides.size === 0 && sizeOverrides.size === 0) return;
    const timer = setTimeout(() => {
      onLayoutChangeRef.current?.({
        positions: Object.fromEntries(posOverrides),
        sizes: Object.fromEntries(sizeOverrides),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [posOverrides, sizeOverrides]);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const sel = selectedIds ?? new Set<string>();
  const setSel = onSelectionChange ?? (() => {});

  // — Fit all
  const fitAll = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const box = getCardsBBox(cards, posOverrides);
    if (!box) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    const vw = c.clientWidth - FIT_PADDING * 2;
    const vh = c.clientHeight - FIT_PADDING * 2;
    // 容器还没 layout 完成 → 跳过这次 fit,等下一次有效尺寸再做
    // 阈值 200x200:小于这个尺寸八成是 flex 还没拿到真实宽高
    if (vw < 200 || vh < 200) {
      fittedOnce.current = false;
      return;
    }
    // 卡少时允许放大到 1.5x,避免一张卡飘在画布中央留大量黑边
    const newZoom = clamp(Math.min(vw / box.w, vh / box.h), ZOOM_MIN, 1.5);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    setZoom(newZoom);
    setPan({
      x: c.clientWidth / 2 - cx * newZoom,
      y: c.clientHeight / 2 - cy * newZoom,
    });
  }, [cards, posOverrides]);

  useLayoutEffect(() => {
    if (autoFit && !fittedOnce.current && containerRef.current) {
      fittedOnce.current = true;
      const id = requestAnimationFrame(fitAll);
      return () => cancelAnimationFrame(id);
    }
  }, [autoFit, fitAll]);

  // 容器尺寸变化(包括首次拿到真实尺寸)→ 自动重新 fit
  useEffect(() => {
    if (!autoFit) return;
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      if (!fittedOnce.current) {
        const id = requestAnimationFrame(fitAll);
        return () => cancelAnimationFrame(id);
      }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [autoFit, fitAll]);

  // — 滚轮缩放(以鼠标为中心)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom((prevZoom) => {
        const newZoom = clamp(
          prevZoom * (1 - e.deltaY * ZOOM_DELTA_RATE),
          ZOOM_MIN,
          ZOOM_MAX,
        );
        setPan((prevPan) => ({
          x: mx - (mx - prevPan.x) * (newZoom / prevZoom),
          y: my - (my - prevPan.y) * (newZoom / prevZoom),
        }));
        return newZoom;
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // — 拖空白处 pan(并清选)
  const handleBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sel.size > 0 && !e.shiftKey) setSel(new Set());
    const start = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    const onMove = (m: PointerEvent) => {
      setPan({ x: m.clientX - start.x, y: m.clientY - start.y });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // — 双击空白 fit-all
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    fitAll();
  };

  // — 键盘快捷键
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && sel.size > 0) {
        setSel(new Set());
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "0") {
        e.preventDefault();
        fitAll();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => clamp(z * 1.1, ZOOM_MIN, ZOOM_MAX));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => clamp(z / 1.1, ZOOM_MIN, ZOOM_MAX));
      } else if (e.key === "a" && sel.size !== cards.length) {
        e.preventDefault();
        const all = new Set<string>();
        for (const c of cards) if (c.interactive !== false) all.add(c.id);
        setSel(all);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitAll, sel, setSel, cards]);

  // — 单卡拖拽 + 选中处理
  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, card: CanvasCardData) => {
      if (card.interactive === false) return;
      // 右键不参与拖拽 / 选中(走 contextmenu)
      if (e.button === 2) return;
      e.stopPropagation();

      // 选中逻辑:Cmd/Shift 多选切换,否则单选(若已选保持)
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        const next = new Set(sel);
        if (next.has(card.id)) next.delete(card.id);
        else next.add(card.id);
        setSel(next);
      } else if (!sel.has(card.id)) {
        setSel(new Set([card.id]));
      }

      // 拖拽:把所有当前选中卡片一起拖,offset 锁定起始 pointer
      const startX = e.clientX;
      const startY = e.clientY;
      // 当前位置(含已有 override)
      const movingIds = sel.has(card.id) ? Array.from(sel) : [card.id];
      const startPositions = new Map<string, CardPos>();
      for (const id of movingIds) {
        const c = cards.find((x) => x.id === id);
        if (!c) continue;
        const ov = posOverrides.get(id);
        startPositions.set(id, { x: ov?.x ?? c.x, y: ov?.y ?? c.y });
      }

      let moved = false;
      const onMove = (m: PointerEvent) => {
        const dxScreen = m.clientX - startX;
        const dyScreen = m.clientY - startY;
        if (Math.abs(dxScreen) + Math.abs(dyScreen) < 4) return; // dead zone
        moved = true;
        const dxCanvas = dxScreen / zoomRef.current;
        const dyCanvas = dyScreen / zoomRef.current;
        setPosOverrides((prev) => {
          const next = new Map(prev);
          for (const [id, sp] of startPositions) {
            next.set(id, { x: sp.x + dxCanvas, y: sp.y + dyCanvas });
          }
          return next;
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (!moved) {
          // 单击未拖动 → 上面已处理选中,无需额外
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [cards, posOverrides, sel, setSel],
  );

  const handleCardContextMenu = (
    e: React.MouseEvent<HTMLDivElement>,
    card: CanvasCardData,
  ) => {
    if (card.interactive === false) return;
    e.preventDefault();
    e.stopPropagation();
    // 右键时:若该卡未选,先把它单独选中
    if (!sel.has(card.id)) setSel(new Set([card.id]));
    onCardContextMenu?.(card.id, e);
  };

  // — 单卡 4 角缩放(SPEC §2.8.3 项 6)
  const handleResizeStart = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      card: CanvasCardData,
      corner: Corner,
    ) => {
      if (card.interactive === false) return;
      e.stopPropagation();
      e.preventDefault();

      const startScreenX = e.clientX;
      const startScreenY = e.clientY;
      const ovPos = posOverrides.get(card.id);
      const ovSize = sizeOverrides.get(card.id);
      const startX = ovPos?.x ?? card.x;
      const startY = ovPos?.y ?? card.y;
      const startW = ovSize?.w ?? card.width;
      const startH = ovSize?.h ?? card.height;
      const aspect = startW / startH;

      const onMove = (m: PointerEvent) => {
        const dxScreen = m.clientX - startScreenX;
        const dyScreen = m.clientY - startScreenY;
        const dxCanvas = dxScreen / zoomRef.current;
        const dyCanvas = dyScreen / zoomRef.current;

        // 默认锁比例(图片卡不该被拉伸);按 Shift 才允许自由 resize
        const lockAspect = !m.shiftKey;
        let newW = startW;
        let newH = startH;
        let newX = startX;
        let newY = startY;

        // 角点拉伸:东西方向(w/x) + 南北方向(h/y)
        const east = corner === "ne" || corner === "se";
        const south = corner === "se" || corner === "sw";
        if (east) {
          newW = Math.max(MIN_CARD_W, startW + dxCanvas);
        } else {
          newW = Math.max(MIN_CARD_W, startW - dxCanvas);
          newX = startX + (startW - newW);
        }
        if (south) {
          newH = Math.max(MIN_CARD_H, startH + dyCanvas);
        } else {
          newH = Math.max(MIN_CARD_H, startH - dyCanvas);
          newY = startY + (startH - newH);
        }
        if (lockAspect) {
          // 取面积变化主导轴,另一轴按比例算
          const wScale = newW / startW;
          const hScale = newH / startH;
          if (Math.abs(wScale - 1) > Math.abs(hScale - 1)) {
            newH = Math.max(MIN_CARD_H, newW / aspect);
            if (!south) newY = startY + (startH - newH);
          } else {
            newW = Math.max(MIN_CARD_W, newH * aspect);
            if (!east) newX = startX + (startW - newW);
          }
        }

        setSizeOverrides((prev) => {
          const next = new Map(prev);
          next.set(card.id, { w: newW, h: newH });
          return next;
        });
        setPosOverrides((prev) => {
          const next = new Map(prev);
          next.set(card.id, { x: newX, y: newY });
          return next;
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [posOverrides, sizeOverrides],
  );

  // 渲染时合并 override 位置 + 尺寸
  const renderedCards = useMemo(
    () =>
      cards.map((c) => {
        const ovP = posOverrides.get(c.id);
        const ovS = sizeOverrides.get(c.id);
        return {
          ...c,
          x: ovP?.x ?? c.x,
          y: ovP?.y ?? c.y,
          width: ovS?.w ?? c.width,
          height: ovS?.h ?? c.height,
        };
      }),
    [cards, posOverrides, sizeOverrides],
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={handleBackgroundPointerDown}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden bg-main-bg cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(44,24,16,0.08) 1px, transparent 1px)",
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* 变换层 */}
      <div
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {renderedCards.map((card) => {
          const isSel = sel.has(card.id);
          const interactive = card.interactive !== false;
          return (
            <div
              key={card.id}
              className={`absolute group ${
                interactive ? "cursor-grab active:cursor-grabbing" : ""
              } ${
                isSel
                  ? "outline outline-[3px] outline-primary-cta outline-offset-[3px] rounded-xl"
                  : ""
              }`}
              style={{
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
              }}
              onPointerDown={(e) => handleCardPointerDown(e, card)}
              onContextMenu={(e) => handleCardContextMenu(e, card)}
            >
              {card.render()}

              {/* SPEC §2.8.3 项 6:4 角拖拽缩放把手(hover 或 selected 时可见) */}
              {interactive &&
                (["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
                  <ResizeHandle
                    key={corner}
                    corner={corner}
                    visible={isSel}
                    invZoom={1 / zoom}
                    onPointerDown={(e) => handleResizeStart(e, card, corner)}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {/* 浮动 zoom controls(右下角)*/}
      <div className="absolute bottom-md right-md flex items-center gap-1 bg-white border border-outline-variant/40 rounded-full shadow-sm px-1 py-1 text-on-surface">
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z / 1.1, ZOOM_MIN, ZOOM_MAX))}
          className="p-1.5 rounded-full hover:bg-surface-container transition-colors"
          aria-label="缩小"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={fitAll}
          className="px-2 py-1 rounded-full hover:bg-surface-container transition-colors text-[12px] font-label tabular-nums min-w-[48px]"
          aria-label="适应屏幕"
          title="双击空白或 Cmd+0"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z * 1.1, ZOOM_MIN, ZOOM_MAX))}
          className="p-1.5 rounded-full hover:bg-surface-container transition-colors"
          aria-label="放大"
        >
          <Plus className="w-4 h-4" />
        </button>
        <span className="w-px h-4 bg-outline-variant/40 mx-1" />
        <button
          type="button"
          onClick={fitAll}
          className="p-1.5 rounded-full hover:bg-surface-container transition-colors"
          aria-label="适应屏幕"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────── 4 角缩放把手 ───────────────────────

const CORNER_CLASS: Record<Corner, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
};

function ResizeHandle({
  corner,
  visible,
  invZoom,
  onPointerDown,
}: {
  corner: Corner;
  /** 选中时常显;未选中时只在 hover 父卡片时显(用 group-hover) */
  visible: boolean;
  /** 1/zoom — 让把手在屏幕上始终是同尺寸,不被 canvas scale 放大 */
  invZoom: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  // 屏幕上想要 12px 把手;canvas 内部要 = 12 * invZoom
  const screenSize = 12;
  const size = screenSize * invZoom;
  return (
    <div
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.stopPropagation()}
      className={`absolute z-20 ${CORNER_CLASS[corner]} ${
        visible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      } transition-opacity bg-white border-2 border-primary-cta shadow-md rounded-sm`}
      style={{ width: size, height: size }}
      aria-label={`resize-${corner}`}
    />
  );
}
