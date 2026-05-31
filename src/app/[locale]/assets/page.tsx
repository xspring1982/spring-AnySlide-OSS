// /assets — 我的项目列表(M5 Day 2)
// sidebar "我的项目" 入口
//
// 视觉:文件夹样式卡片(顶部小标签条 + 主体封面预览),首位是 "+ 新建项目" 引导卡

import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { listProjects } from "@/lib/projects/repo";
import { NewProjectButton } from "@/components/projects/NewProjectButton";
import { ProjectCard } from "@/components/projects/ProjectCard";

export default async function AssetsPage() {
  const a = await auth();
  if (!a.userId) {
    redirect("/login?redirect_url=/assets");
  }
  const projects = await listProjects(a.userId, 100);
  const t = await getTranslations();

  return (
    <main className="min-h-screen bg-main-bg">
      <header className="h-16 flex items-center justify-between px-md border-b border-outline-variant/30 bg-white/70 backdrop-blur-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[14px] text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span aria-hidden>←</span>
          <span>{t("nav.backHome")}</span>
        </Link>
        <h1 className="font-h2 text-h2 text-on-surface">{t("sidebar.myProjects")}</h1>
        <div className="text-[12px] text-on-surface-variant">
          {t("projects.totalCount", { count: projects.length })}
        </div>
      </header>

      <section className="max-w-[1400px] mx-auto px-md py-xl">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {/* 首位:+ 新建项目 引导卡(虚线边框,文件夹样式)*/}
          <NewProjectButton />

          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={{
                id: p.id,
                title: p.title,
                mode: p.mode,
                coverImageUrl: p.coverImageUrl ?? null,
                imageCount: p.imageCount,
                taskCount: p.taskCount,
                updatedAt:
                  p.updatedAt instanceof Date
                    ? p.updatedAt.toISOString()
                    : (p.updatedAt as string),
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
