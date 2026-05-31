"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  Sparkles,
  Wallet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Transaction {
  id: string;
  delta: number;
  reason: string;
  taskId: string | null;
  modelUsed: string | null;
  createdAt: string;
}

interface MeData {
  authenticated: true;
  creditBalance: number;
  plan: string;
  creditResetAt: string | null;
  email: string;
  stripeEnabled?: boolean;
  transactions: Transaction[];
}

type TopupId = "topup_5" | "topup_20" | "topup_50";
type SubId = "pro_monthly" | "pro_yearly";
type ProductId = TopupId | SubId;

interface TopupOption {
  id: TopupId;
  /** 主价格(USD) */
  label: string;
  /** 中文 locale 括号内的人民币近似(汇率参考 1 USD ≈ 7) */
  cnyApprox: string;
  /** badge i18n key suffix(对应 billing.topupTags.{key});undefined 即无 badge */
  tagKey?: string;
}

/** 全平台统一 USD 计价(2026-05-06)。中文 locale 附 ≈ ¥X 提示。 */
const TOPUPS_USD: ReadonlyArray<TopupOption> = [
  { id: "topup_5", label: "$5 / 500", cnyApprox: "¥35" },
  { id: "topup_20", label: "$20 / 2200", cnyApprox: "¥140", tagKey: "tag10" },
  { id: "topup_50", label: "$50 / 6000", cnyApprox: "¥350", tagKey: "tag20" },
];

export function BillingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const isZh = locale.startsWith("zh"); // 包含 zh / zh-TW
  const [data, setData] = useState<MeData | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<ProductId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          setUnauthenticated(true);
          return;
        }
        const d = (await r.json()) as MeData;
        setData(d);
      })
      .catch(() => {
        /* 网络错误,加载失败 */
      })
      .finally(() => setLoading(false));
  }, []);

  async function startCheckout(productId: ProductId) {
    if (checkingOut) return;
    setCheckingOut(productId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, locale }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        alert(json.error ?? `${t("billing.checkoutFailed")} (HTTP ${res.status})`);
        setCheckingOut(null);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      console.error("[checkout]", err);
      alert(err instanceof Error ? err.message : t("billing.networkError"));
      setCheckingOut(null);
    }
  }

  async function openPortal() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        alert(json.error ?? `${t("billing.openPortalFailed")} (HTTP ${res.status})`);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : t("billing.networkError"));
    }
  }

  return (
    <main className="min-h-screen bg-main-bg">
      <header className="h-16 flex items-center px-md border-b border-outline-variant/30 bg-white/70 backdrop-blur-sm">
        <Link
          href="/"
          className="p-2 -ml-2 rounded-md hover:bg-surface-container transition-colors"
          aria-label={t("nav.backHome")}
        >
          <ChevronLeft className="w-5 h-5 text-on-surface" />
        </Link>
        <h1 className="font-h3 text-h3 text-on-surface ml-2">{t("billing.title")}</h1>
      </header>

      <div className="max-w-[800px] mx-auto px-md py-xl">
        {loading && (
          <div className="text-center text-on-surface-variant py-xl">{t("common.loading")}</div>
        )}

        {!loading && unauthenticated && (
          <div className="rounded-2xl bg-white border border-outline-variant/30 p-2xl text-center shadow-sm">
            <div className="text-5xl mb-md">✨</div>
            <h2 className="font-h2 text-h2 text-on-surface mb-sm">{t("billing.loginToView")}</h2>
            <p className="text-on-surface-variant text-[14px] mb-lg">
              {t("billing.signupBonus")}
            </p>
            <div className="flex items-center justify-center gap-md">
              <Link
                href="/sign-up"
                className="px-md py-2.5 rounded-full bg-primary-cta text-on-primary text-[14px] font-medium hover:bg-primary-container transition-colors"
              >
                {t("billing.signupCta")}
              </Link>
              <Link
                href="/login"
                className="px-md py-2.5 rounded-full border border-outline-variant/60 text-on-surface text-[14px] font-medium hover:bg-surface-container transition-colors"
              >
                {t("billing.haveAccount")}
              </Link>
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            {/* 顶部余额卡 */}
            <section className="rounded-2xl bg-white border border-outline-variant/30 p-xl shadow-sm">
              <div className="flex items-center gap-md">
                <div className="w-14 h-14 rounded-xl bg-primary-cta/10 flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-primary-cta" />
                </div>
                <div className="flex-1">
                  <div className="text-label font-label text-on-surface-variant uppercase tracking-wider">
                    {t("billing.currentBalance")}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-h1 text-[36px] text-on-surface tabular-nums">
                      {data.creditBalance}
                    </span>
                    <span className="text-body font-body text-on-surface-variant">
                      {t("common.credits")}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-label ${
                      data.plan === "pro"
                        ? "bg-primary-cta text-on-primary"
                        : data.plan === "plus"
                          ? "bg-primary-container text-on-primary-container"
                          : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {data.plan === "pro" ? "Pro" : data.plan === "plus" ? "Plus" : "Free"}
                  </span>
                  {data.email && (
                    <div className="text-[11px] text-on-surface-variant/70 mt-1 truncate max-w-[180px]">
                      {data.email}
                    </div>
                  )}
                </div>
              </div>

              {/* 充值入口 — 试用期(stripeEnabled=false)隐藏所有付费按钮 */}
              {data.stripeEnabled === false ? (
                <div className="mt-md rounded-lg bg-amber-50 border border-amber-200 px-md py-3">
                  <div className="text-[13px] text-amber-800 font-medium mb-1">
                    {t("billing.trialBannerTitle")}
                  </div>
                  <div className="text-[12px] text-amber-700/90 leading-relaxed">
                    {t("billing.trialBannerBody")}
                  </div>
                </div>
              ) : (
                <div className="mt-md flex items-center gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    disabled={!!checkingOut}
                    className="px-4 py-2 rounded-lg bg-primary-cta text-on-primary text-[13px] font-label hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("billing.topupCta")}
                  </button>
                  <button
                    type="button"
                    onClick={() => startCheckout("pro_monthly")}
                    disabled={!!checkingOut || data.plan === "pro"}
                    className="px-4 py-2 rounded-lg border border-outline-variant/60 text-on-surface text-[13px] font-label hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={
                      data.plan === "pro"
                        ? t("billing.youArePro")
                        : t("billing.proMonthlyTooltip")
                    }
                  >
                    {checkingOut === "pro_monthly"
                      ? t("billing.redirecting")
                      : data.plan === "pro"
                        ? t("billing.proActive")
                        : t("billing.proMonthlyShort")}
                  </button>
                  <button
                    type="button"
                    onClick={() => startCheckout("pro_yearly")}
                    disabled={!!checkingOut || data.plan === "pro"}
                    className="px-4 py-2 rounded-lg border border-outline-variant/60 text-on-surface text-[13px] font-label hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={t("billing.proYearlyTooltip")}
                  >
                    {checkingOut === "pro_yearly"
                      ? t("billing.redirecting")
                      : t("billing.proYearlyShort")}
                  </button>
                  {data.plan === "pro" && (
                    <button
                      type="button"
                      onClick={openPortal}
                      className="px-4 py-2 rounded-lg border border-outline-variant/60 text-on-surface text-[13px] font-label hover:bg-surface-container transition-colors"
                      title={t("billing.managePortalTooltip")}
                    >
                      {t("billing.managePortal")}
                    </button>
                  )}
                  {pickerOpen && (
                    <div className="absolute top-full left-0 mt-2 z-20 min-w-[280px] rounded-xl bg-white border border-outline-variant/40 shadow-xl py-1">
                      {TOPUPS_USD.map((topup) => (
                        <button
                          key={topup.id}
                          type="button"
                          onClick={() => {
                            setPickerOpen(false);
                            startCheckout(topup.id);
                          }}
                          disabled={!!checkingOut}
                          className="w-full flex items-center justify-between px-md py-2 text-left text-[13px] hover:bg-surface-container/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="flex items-baseline gap-1.5">
                            <span className="text-on-surface font-medium">
                              {topup.label} {t("common.credits")}
                            </span>
                            {isZh && (
                              <span className="text-[11px] text-on-surface-variant/70">
                                ≈ {topup.cnyApprox}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center">
                            {topup.tagKey && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-primary-cta/10 text-primary-cta font-medium">
                                {t(`billing.topupTags.${topup.tagKey}`)}
                              </span>
                            )}
                            {checkingOut === topup.id && (
                              <span className="ml-2 text-[11px] text-on-surface-variant">…</span>
                            )}
                          </span>
                        </button>
                      ))}
                      <div className="px-md py-1.5 mt-1 border-t border-outline-variant/30 text-[10px] text-on-surface-variant/70 leading-snug">
                        {t("billing.payHint")}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 流水 */}
            <section className="mt-xl">
              <h2 className="text-h3 font-h3 text-on-surface mb-md">{t("billing.txTitle")}</h2>
              {data.transactions.length === 0 ? (
                <div className="text-center text-on-surface-variant py-xl bg-white rounded-xl border border-outline-variant/30">
                  {t("billing.txEmpty")}
                </div>
              ) : (
                <div className="rounded-xl bg-white border border-outline-variant/30 divide-y divide-outline-variant/30 overflow-hidden">
                  {data.transactions.map((tx) => {
                    const isCredit = tx.delta > 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-md px-md py-3 hover:bg-surface-container/40 transition-colors"
                      >
                        <div className="shrink-0">
                          {isCredit ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-on-surface-variant" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-on-surface text-[13px]">
                            {t(`billing.reasons.${tx.reason}` as never)}
                          </div>
                          <div className="text-[11px] text-on-surface-variant/70 mt-0.5 truncate">
                            {new Date(tx.createdAt).toLocaleString(locale, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {tx.taskId && (
                              <>
                                {" · "}
                                <Link
                                  href={`/task/${tx.taskId}`}
                                  className="text-primary-cta hover:underline"
                                >
                                  task/{tx.taskId.slice(0, 6)}…
                                </Link>
                              </>
                            )}
                            {tx.modelUsed && (
                              <span className="ml-1 opacity-60">· {tx.modelUsed}</span>
                            )}
                          </div>
                        </div>
                        <div
                          className={`shrink-0 font-h3 tabular-nums ${
                            isCredit ? "text-emerald-700" : "text-on-surface"
                          }`}
                        >
                          {isCredit ? "+" : ""}
                          {tx.delta}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
