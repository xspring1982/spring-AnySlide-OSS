// SPEC §5.4 — sidebar 余额显示
// 一直 polling /api/me 拿当前余额(每 30s 自动刷新,任务完成后会更新)
// 未登录:显示 "登录领 60 积分" CTA,引导注册

"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { Sparkles, Wallet, Gift, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

interface MeData {
  authenticated: true;
  creditBalance: number;
  plan: string;
}

export function SidebarBalance() {
  const t = useTranslations();
  const [me, setMe] = useState<MeData | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  // T2-47:账号被风控(/api/me 返 403,通常因为一次性邮箱拦截)
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          if (!aborted) {
            setUnauthenticated(true);
            setMe(null);
          }
          return;
        }
        if (res.status === 403) {
          // T2-47:账号被风控 → 拿后端友好文案显示 chip
          let msg = t("sidebar.blockedFull");
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* keep default */
          }
          if (!aborted) {
            setBlocked(msg);
            setMe(null);
          }
          return;
        }
        if (!res.ok) return;
        const d = (await res.json()) as MeData;
        if (!aborted) {
          setMe(d);
          setUnauthenticated(false);
          setBlocked(null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30_000); // 每 30s 刷新一次
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, []);

  // T2-47:风控态 — 显示醒目红色 chip + 邮件 mailto,引导用户求助
  if (blocked) {
    return (
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("sidebar.blockedMailSubject"))}`}
        className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg bg-error-container/40 text-error hover:bg-error-container/60 transition-colors"
        title={blocked}
      >
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[12px] font-medium truncate">{t("sidebar.blocked")}</span>
      </a>
    );
  }

  // 未登录:登录引导
  if (unauthenticated) {
    return (
      <Link
        href="/sign-up"
        className="flex items-center justify-center gap-1.5 px-3 py-2 mx-2 rounded-lg bg-primary-cta/10 text-primary-cta hover:bg-primary-cta/20 transition-colors"
        title={t("banner.text")}
      >
        <Gift className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[12px] font-medium">{t("sidebar.loginToGet")}</span>
      </Link>
    );
  }

  if (loading || !me) {
    return (
      <Link
        href="/settings/billing"
        className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg bg-surface-container/40 text-on-surface-variant text-[12px] font-label"
      >
        <Wallet className="w-3.5 h-3.5 opacity-50" />
        <span className="opacity-50">{t("common.loading")}</span>
      </Link>
    );
  }

  const planLabel =
    me.plan === "pro" ? "Pro" : me.plan === "plus" ? "Plus" : "Free";
  const isLowBalance = me.creditBalance < 30;

  return (
    <Link
      href="/settings/billing"
      // as-sidebar-balance class 让 globals.css 在 .as-sidebar-collapsed 父级下
      // 重排:只显示数字 + 图标(纵向),隐藏 "积分" 文字 + plan label
      className={`as-sidebar-balance flex items-center gap-2 px-3 py-2 mx-2 rounded-lg transition-colors ${
        isLowBalance
          ? "bg-error-container/40 text-error hover:bg-error-container/60"
          : "bg-primary-cta/8 text-on-surface hover:bg-primary-cta/15"
      }`}
      title={t("sidebar.balanceTitle")}
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-80" />
      <div className="as-sidebar-balance-detail flex-1 min-w-0 flex items-baseline gap-1">
        <span className="text-[14px] font-h3 tabular-nums">{me.creditBalance}</span>
        <span className="text-[11px] opacity-60">{t("common.credits")}</span>
      </div>
      <span className="as-sidebar-balance-plan text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
        {planLabel}
      </span>
      {/* 折叠态下显示的迷你数字(globals.css 控制可见性)*/}
      <span className="as-sidebar-balance-mini text-[12px] font-h3 tabular-nums" aria-hidden>
        {me.creditBalance}
      </span>
    </Link>
  );
}
