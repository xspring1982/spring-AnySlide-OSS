"use client";

// 我的项目页(/assets)单个项目卡片 — client component(因为要交互)
//
// 交互:
//   - 单击卡片(空白)→ 跳 /project/[id]
//   - 双击 title → inline 编辑模式;Enter 或失焦保存(PATCH /api/projects/[id])
//   - 右键卡片 → 自定义 context menu(删除)
//   - 删除 → 确认 → DELETE /api/projects/[id] → router.refresh()

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Trash2, Pencil } from "lucide-react";
const MODE_EMOJI: Record<string, string> = {
  cards: "📇",
  image: "🎨",
  slides: "📊",
};
const MODE_TINT: Record<string, string> = {
  cards: "from-rose-50 to-amber-50",
  image: "from-violet-50 to-sky-50",
  slides: "from-emerald-50 to-teal-50",
};

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    mode: string;
    coverImageUrl: string | null;
    imageCount: number;
    taskCount: number;
    updatedAt: string | Date;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const t = useTranslations();
  const MODE_LABEL: Record<string, string> = {
    cards: t("modes.cards"),
    image: t("modes.image"),
    slides: t("modes.slides"),
  };
  const [title, setTitle] = useState(project.title);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // 全局点击关闭 context menu
  useEffect(() => {
    if (!menu) return;
    const onClick = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function openProject() {
    if (editing) return;
    router.push(`/project/${project.id}`);
  }

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === project.title) {
      setTitle(project.title); // 还原
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `${t("projects.renameFailed")} (HTTP ${res.status})`);
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("projects.renameFailed"));
      setTitle(project.title);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (deleting) return;
    if (!window.confirm(t("projects.deleteConfirm", { title: project.title }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `${t("projects.deleteFailed")} (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("projects.deleteFailed"));
    } finally {
      setDeleting(false);
      setMenu(null);
    }
  }

  return (
    <>
      <article
        className={`group rounded-lg bg-white border border-outline-variant/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden cursor-pointer ${
          deleting ? "opacity-50 pointer-events-none" : ""
        }`}
        title={project.title}
        onClick={openProject}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* 顶部 mode 标签条 */}
        <div
          className={`h-5 bg-gradient-to-r ${
            MODE_TINT[project.mode] ?? "from-stone-50 to-amber-50"
          } border-b border-outline-variant/20 flex items-center px-2 gap-1`}
        >
          <span className="text-[10px]">{MODE_EMOJI[project.mode] ?? "📄"}</span>
          <span className="text-[9px] font-label text-on-surface-variant truncate">
            {MODE_LABEL[project.mode] ?? project.mode}
          </span>
        </div>

        {/* 主体封面 */}
        <div className="aspect-square bg-surface-container relative overflow-hidden">
          {project.coverImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={project.coverImageUrl}
              alt={project.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-on-surface-variant/50">
              <span className="text-2xl">📁</span>
              <span className="text-[10px] font-label">{t("projects.emptyFolder")}</span>
            </div>
          )}
          {project.imageCount > 1 && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-on-surface/80 text-white text-[9px] font-label">
              {project.imageCount}
            </span>
          )}
        </div>

        {/* 底部信息条 — 标题区可双击进入编辑 */}
        <div className="px-2 py-1.5 border-t border-outline-variant/15">
          {editing ? (
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => void saveTitle()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveTitle();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTitle(project.title);
                  setEditing(false);
                }
              }}
              disabled={saving}
              maxLength={80}
              className="w-full text-[11px] bg-white border border-primary-cta/60 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary-cta/40"
            />
          ) : (
            <h3
              className="font-label text-[11px] text-on-surface line-clamp-1 cursor-text hover:text-primary-cta"
              title={t("projects.doubleClickToRename")}
              onClick={(e) => {
                // 阻止冒泡到 article(避免触发跳转);单击不进入编辑,
                // 双击才进入(不影响 article 的整张卡跳转)
                e.stopPropagation();
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              {project.title}
            </h3>
          )}
          <div className="flex items-center justify-between text-[10px] text-on-surface-variant/60 mt-0.5">
            <span>{t("projects.timesCount", { count: project.taskCount })}</span>
            <time>
              {new Date(project.updatedAt).toLocaleDateString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
              })}
            </time>
          </div>
        </div>
      </article>

      {/* 右键 context menu */}
      {menu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg bg-white border border-outline-variant/40 shadow-xl py-1"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setMenu(null);
              setEditing(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-on-surface hover:bg-surface-container/40"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden />
            {t("projects.rename")}
          </button>
          <button
            type="button"
            onClick={() => void deleteProject()}
            disabled={deleting}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-error hover:bg-error/10 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
            {t("projects.deleteProject")}
          </button>
        </div>
      )}
    </>
  );
}
