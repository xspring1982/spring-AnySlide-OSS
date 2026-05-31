// /assets 首位 "+ 新建项目" 引导卡
// 点击直接创空 project(默认 cards,进工作区可改 mode,出图后锁)→ 跳 /project/[id]

"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function NewProjectButton() {
  const t = useTranslations();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleClick() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cards", title: t("sidebar.newProjectDefaultTitle") }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/project/${id}`);
    } catch (err) {
      console.error("[NewProject] create failed:", err);
      window.alert(err instanceof Error ? err.message : t("errors.generic"));
      setCreating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={creating}
      className="rounded-lg border-2 border-dashed border-primary-cta/40 hover:border-primary-cta hover:bg-primary-cta/5 disabled:opacity-60 disabled:cursor-wait transition-all overflow-hidden flex flex-col items-center justify-center aspect-square text-primary-cta gap-2 group"
    >
      <div className="w-9 h-9 rounded-full bg-primary-cta/10 group-hover:bg-primary-cta group-hover:text-white flex items-center justify-center transition-colors">
        {creating ? (
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </div>
      <div className="text-center">
        <div className="text-[11px] font-medium">
          {creating ? t("common.creating") : t("sidebar.newProject")}
        </div>
      </div>
    </button>
  );
}
