// Sidebar 生成历史区:接真实 /api/projects 数据,按 updated_at 倒序前 8 个
// 每条点击跳 /project/[id]

"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock3, ChevronDown, Image as ImageIcon, Presentation, PanelsTopLeft } from "lucide-react";
import { useTranslations } from "next-intl";

const COLLAPSE_STORAGE = "anyslide-history-collapsed";

interface Item {
  id: string;
  mode: "cards" | "image" | "slides";
  title: string;
  imageCount: number;
}

const ICON_BY_MODE = {
  cards: PanelsTopLeft,
  image: ImageIcon,
  slides: Presentation,
} as const;

export function SidebarRecentProjects() {
  const t = useTranslations();
  const pathname = usePathname();
  const [items, setItems] = useState<Item[] | null>(null);
  const [unauth, setUnauth] = useState(false);
  // 折叠状态:localStorage 持久化(避免每次刷新都展开)
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE) === "1");
    } catch {
      /* localStorage 不可用 */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(COLLAPSE_STORAGE, "1");
        else localStorage.removeItem(COLLAPSE_STORAGE);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // pathname 变化(切项目 / 新建项目 / 改名后回 /assets 等)→ 重新拉一次,
  // 让 sidebar 始终显示最新项目列表
  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (res.status === 401) {
          if (!aborted) setUnauth(true);
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as { projects: Item[] };
        if (!aborted) setItems((json.projects ?? []).slice(0, 8));
      } catch {
        /* ignore */
      }
    }
    load();
  }, [pathname]);

  if (unauth) return null;

  // 共用的可点击 label(chevron 旋转表示折叠态)
  const labelButton = (
    <button
      type="button"
      onClick={toggleCollapsed}
      className="as-sidebar-label flex items-center justify-between w-full cursor-pointer hover:text-on-surface transition-colors"
      aria-expanded={!collapsed}
      title={collapsed ? t("common.expand") : t("common.collapse")}
    >
      <span>{t("sidebar.history")}</span>
      <ChevronDown
        aria-hidden
        className={`w-3 h-3 opacity-50 transition-transform ${collapsed ? "-rotate-90" : ""}`}
      />
    </button>
  );

  if (items === null) {
    return (
      <section className="as-sidebar-section as-recent-section">
        {labelButton}
        {!collapsed && (
          <div className="px-3 py-2 text-[11px] text-on-surface-variant/50">{t("common.loading")}</div>
        )}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="as-sidebar-section as-recent-section">
        {labelButton}
        {!collapsed && (
          <div className="px-3 py-2 text-[11px] text-on-surface-variant/50">—</div>
        )}
      </section>
    );
  }

  return (
    <section className="as-sidebar-section as-recent-section">
      {labelButton}
      {!collapsed &&
        items.map((p) => {
          const Icon = ICON_BY_MODE[p.mode] ?? Clock3;
          return (
            <Link
              key={p.id}
              href={`/project/${p.id}`}
              className="as-recent-item"
              title={p.title}
            >
              <Icon aria-hidden />
              <span>{p.title}</span>
            </Link>
          );
        })}
    </section>
  );
}
