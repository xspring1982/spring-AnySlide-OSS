// 共享语言切换组件(2026-05-10 PR25)
//
// 之前语言切换只在 DashboardHome 内联实现,营销 / 登录 / 法律页都没有 →
// Google 爬公开页时拿不到对等的 5 语言 anchor,GSC 内链分布 5/1/1/0 严重不对称。
//
// 本组件抽出可复用逻辑,被 MarketingTopBar / SiteFooter / DashboardHome 共用:
//   - variant="topbar":右上角 Globe icon + dropdown(SSR 输出 5 个 anchor 不藏,
//                       关闭态走 opacity:0 + pointer-events:none,让爬虫看见所有 5 个 anchor)
//   - variant="footer":footer 铺平 5 个 anchor(永远可见)
//
// 行为关键点:
//   - 点击写 NEXT_LOCALE cookie 显式覆盖浏览器 Accept-Language(否则 middleware
//     会按 Accept-Language=zh 又跳回 /zh,切英文失败)
//   - window.location 强制 hard navigate(绕过 next-intl 客户端缓存)

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Globe } from "lucide-react";
import type { Locale } from "@/i18n/routing";

interface LanguageEntry {
  label: string;
  short: string;
  href: string;
  locale: Locale;
}

// 5 个 locale 用每个语言的本族名(raphael.app 风格)
const LANGUAGES: LanguageEntry[] = [
  { label: "English", short: "EN", href: "/", locale: "en" },
  { label: "简体中文", short: "简体中文", href: "/zh", locale: "zh" },
  { label: "繁體中文", short: "繁體中文", href: "/zh-TW", locale: "zh-TW" },
  { label: "日本語", short: "日本語", href: "/ja", locale: "ja" },
  { label: "한국어", short: "한국어", href: "/ko", locale: "ko" },
];

function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function findActive(pathname: string): LanguageEntry {
  return (
    LANGUAGES.find((l) => {
      if (l.href === "/") return pathname === "/";
      return pathname === l.href || pathname.startsWith(`${l.href}/`);
    }) ?? LANGUAGES[0]
  );
}

interface Props {
  /** topbar = 右上角 Globe dropdown;footer = 横铺 5 个 anchor */
  variant?: "topbar" | "footer";
  /** 额外的 className 给容器 */
  className?: string;
}

export function LanguagePicker({ variant = "topbar", className = "" }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const active = findActive(pathname);

  if (variant === "footer") {
    // footer:横铺 5 个 anchor,永远可见,SEO 最友好
    return (
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${className}`}
        aria-label={t("dashboard.languagePicker")}
      >
        <Globe className="w-3.5 h-3.5 opacity-60 shrink-0" aria-hidden />
        {LANGUAGES.map((l, i) => (
          <span key={l.locale} className="inline-flex items-center gap-2">
            {i > 0 && <span className="opacity-30" aria-hidden>·</span>}
            <Link
              href={l.href}
              hrefLang={l.locale}
              onClick={() => setLocaleCookie(l.locale)}
              className={`hover:text-primary-cta transition-colors ${
                l.locale === active.locale
                  ? "text-on-surface font-medium"
                  : "text-on-surface-variant"
              }`}
            >
              {l.label}
            </Link>
          </span>
        ))}
      </div>
    );
  }

  return <TopbarPicker active={active} t={t} className={className} />;
}

/**
 * topbar dropdown:即使收起也 SSR 5 个 anchor(opacity:0 + pointer-events:none 隐藏,
 * 不用 hidden 属性,这样 Google 爬虫仍能识别 anchor 计入内链)
 */
function TopbarPicker({
  active,
  t,
  className,
}: {
  active: LanguageEntry;
  t: ReturnType<typeof useTranslations>;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外面关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("dashboard.languagePicker")}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-on-surface hover:bg-surface-container/60 text-[13px] font-label transition-colors"
      >
        <Globe className="w-3.5 h-3.5 opacity-70" aria-hidden />
        <span>{active.short}</span>
        <ChevronDown className="w-3 h-3 opacity-60" aria-hidden />
      </button>
      {/* 关键:不用 hidden / display:none(那样 Google 不计 anchor),
          而用 opacity + pointer-events 隐藏,SSR 仍输出 5 个 <a href="..."> */}
      <div
        role="menu"
        className={`absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md bg-white shadow-lg border border-outline-variant/30 py-1 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {LANGUAGES.map((l) => (
          <Link
            key={l.locale}
            href={l.href}
            hrefLang={l.locale}
            role="menuitem"
            onClick={(e) => {
              setLocaleCookie(l.locale);
              setOpen(false);
              // 强制 hard navigate,绕过 next-intl 客户端缓存
              e.preventDefault();
              window.location.href = l.href;
            }}
            className={`block px-3 py-1.5 text-[13px] hover:bg-surface-container transition-colors ${
              l.locale === active.locale
                ? "text-primary-cta font-medium"
                : "text-on-surface"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
