"use client";

import {
  Clock3,
  FileText,
  FolderOpen,
  Home,
  ImageIcon,
  // LayoutTemplate, // 模版库下线,Phase 2 T2-50 恢复
  PanelsTopLeft,
  PanelLeft,
  Plus,
  Presentation,
  Search,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SidebarBalance } from "./SidebarBalance";
import { SidebarRecentProjects } from "./SidebarRecentProjects";

type AppSidebarProps = {
  activeCreationMode: CreationMode;
  onHome: () => void;
  /** M5+:可选 — sidebar + 新建项目按钮内置创空 project + 跳转,该回调仅作为额外副作用 */
  onNewTask?: () => void;
  onCreationModeChange: (mode: CreationMode) => void;
  onToggle: () => void;
};

type CreationMode = "AI 图文卡片" | "AI 幻灯片" | "AI 图片";

const recentItems = [
  "职场晋升复盘卡片",
  "读书笔记：长期主义",
  "理财风险提示模板",
  "美妆成分解析套图",
];

// 2026-05-05 i18n PR 2.2:label 改用 i18n key,在组件内 t() 解析
// 2026-05-06 用户决策:模版库暂时下线,Phase 2 重做(见 docs/todo.md T2-50)
const primaryItems: Array<{
  labelKey: string;
  oldLabel: string; // legacy 字段,某些 active state 判断仍用
  icon: LucideIcon;
  href: string;
}> = [
  { labelKey: "sidebar.home", oldLabel: "主页", icon: Home, href: "/" },
  { labelKey: "sidebar.myProjects", oldLabel: "我的项目", icon: FolderOpen, href: "/assets" },
  // { labelKey: "sidebar.templates", oldLabel: "模版库", icon: LayoutTemplate, href: "/templates" },
];

// 2026-05-04 调顺:幻灯片模板矩阵最丰富,放第一位引导用户
const creationItems = [
  { label: "AI 幻灯片", icon: Presentation },
  { label: "AI 图文卡片", icon: PanelsTopLeft },
  { label: "AI 图片", icon: ImageIcon },
] satisfies Array<{ label: CreationMode; icon: LucideIcon }>;

export function AppSidebar({
  activeCreationMode,
  onHome,
  onNewTask,
  onCreationModeChange,
  onToggle,
}: AppSidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  // 2026-05-06 修:不再立即 POST /api/projects 创空 project,
  // 改为直接跳 /task/new 让用户自由编辑;真提交时 /api/tasks 会自动建 project + task。
  // 解决 3 个问题:
  //   ① 不再产生空"未命名项目"占用我的项目 + 生成历史
  //   ② NewTaskWorkspace 收不到 projectId → modeLocked = false → mode tabs 可以自由切换
  //   ③ 不再有"已在我的项目生成新建项目"的误导 toast(实际此时还没建)
  function handleCreateProject() {
    if (creating) return;
    setCreating(true);
    try {
      router.push("/task/new");
      onNewTask?.();
    } finally {
      setCreating(false);
    }
  }
  return (
    <aside className="as-side-rail" aria-label="Primary">
      <div className="as-sidebar-top">
        <button
          className="as-sidebar-toggle"
          type="button"
          aria-label="Collapse sidebar"
          onClick={onToggle}
        >
          <PanelLeft aria-hidden />
        </button>
        <Link className="as-sidebar-brand" href="/" aria-label="AnySlide home" onClick={onHome}>
          <BrandLogo logoSize={30} fontSize={22} />
        </Link>
        <button className="as-sidebar-search" type="button" aria-label="Search">
          <Search aria-hidden />
        </button>
      </div>

      <nav className="as-sidebar-nav" aria-label="Primary navigation">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);

          if (item.oldLabel === "主页") {
            // 主页:走 onHome 回调,某些页面会有特殊重置逻辑
            return (
              <button
                key={item.labelKey}
                className="as-sidebar-item as-primary-item"
                type="button"
                onClick={onHome}
              >
                <Icon aria-hidden />
                <span>{label}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.labelKey}
              href={item.href}
              className="as-sidebar-item as-primary-item"
            >
              <Icon aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 2026-05-06 用户反馈:[新建项目] 放到 [主页] 下方,主页占位更顺手 */}
      <button
        className="as-create-project"
        type="button"
        onClick={handleCreateProject}
        disabled={creating}
      >
        <Plus aria-hidden />
        <span>{creating ? t("common.loading") : t("sidebar.newProject")}</span>
      </button>

      {/* 2026-05-05 用户反馈:删 sidebar「创作」区 — 输入框上方已有 mode tabs,重复 */}

      {/* 生成历史:真实 /api/projects 数据(M5 起替换假数据)*/}
      <SidebarRecentProjects />

      <div className="as-sidebar-spacer" />

      {/* M3.5 余额显示 */}
      <SidebarBalance />

      {/* 新手任务卡片暂时下线,逻辑未实现 — 见 docs/todo.md T2-28 */}

      <nav className="as-compact-nav" aria-label="Product">
        <Link href="/" aria-label="Home">
          <Home aria-hidden />
        </Link>
        <Link href="/task/new" aria-label={t("sidebar.newTask")}>
          <WalletCards aria-hidden />
        </Link>
      </nav>
    </aside>
  );
}
