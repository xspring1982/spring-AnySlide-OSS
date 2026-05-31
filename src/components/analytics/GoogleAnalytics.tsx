// 2026-05-07 L-03 / T2-64 后续：Google Analytics 4 (gtag.js) 加载组件
//
// 仅当 NEXT_PUBLIC_GA_ID 设置时才加载脚本,本地 dev 默认不设 → 不污染 GA 数据。
// 生产环境配置 NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX 后,所有页面自动追踪 PV / UV / 来源 / Web Vitals。
//
// 2026-05-17 GDPR 合规改造:
// - 接入 ConsentProvider:仅当用户同意 analytics 后才注入 Script 标签
// - 用户撤回同意时 -> consent 变 false -> 不再注入新 Script + 用 gtag consent update 通知 GA 停止收集
// - SSR / 首次 hydration 阶段始终 noop(useAnalyticsConsent 在 hydrated=false 时返回 false)
//
// 2026-05-18 Geo gate 后续行为:ConsentProvider 对 ROW(非 EU)用户默认 auto-grant,
// 所以美国 / 亚洲等用户进站 banner 不弹、GA 直接装,不影响转化数据 — 本组件无需特殊处理,
// useAnalyticsConsent 已经透出统一的"是否可以收集"判断。
//
// 用法:在 [locale]/layout.tsx 的 <body> 里渲染 <GoogleAnalytics />。
//
// 关联:
// - TODOLIST 零章节 L-03
// - SPEC §6.5.4 第三方分析(GA4 / PostHog)
// - src/lib/consent/ConsentProvider.tsx

"use client";

import Script from "next/script";
import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useAnalyticsConsent } from "@/lib/consent/ConsentProvider";

export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const { isLoaded, userId } = useAuth();
  const analyticsAllowed = useAnalyticsConsent();

  // 2026-05-09:登录用户的 Clerk userId 灌给 GA 作为 user_id,跨设备 / 跨浏览器去重
  // 不传 user_id 时 GA4 走 device-based identity(_ga cookie),同一个真人换浏览器
  // / 隐私模式 / 切 VPN 都会被算成多个用户。传了 user_id 后 GA4 会按 Clerk userId 合并。
  //
  // 2026-05-17:加 analyticsAllowed 守卫,未同意时不发 config(避免在用户撤回后仍然发 user_id)
  useEffect(() => {
    if (!gaId || !isLoaded || !analyticsAllowed || typeof window === "undefined")
      return;
    const gtag = (
      window as unknown as { gtag?: (...args: unknown[]) => void }
    ).gtag;
    if (typeof gtag !== "function") return;
    if (userId) {
      gtag("config", gaId, { user_id: userId });
    } else {
      // 注销 / 未登录:清掉之前可能设过的 user_id
      gtag("config", gaId, { user_id: undefined });
    }
  }, [gaId, isLoaded, userId, analyticsAllowed]);

  // 2026-05-17:用户撤回同意时,通过 gtag consent update 通知 GA 停止收集
  // (Script 标签即便条件渲染移除,gtag 函数和已加载的脚本还在内存里;用 consent API 是官方推荐做法)
  useEffect(() => {
    if (!gaId || typeof window === "undefined") return;
    const gtag = (
      window as unknown as { gtag?: (...args: unknown[]) => void }
    ).gtag;
    if (typeof gtag !== "function") return;
    gtag("consent", "update", {
      analytics_storage: analyticsAllowed ? "granted" : "denied",
      ad_storage: "denied", // 我们不做广告追踪,永远 denied
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }, [gaId, analyticsAllowed]);

  // 没设 ID 直接 noop(本地 dev / 预览环境不污染 GA 数据)
  if (!gaId) return null;

  // 用户未同意 -> 完全不注入 Script,即 _ga cookie 也不会写
  if (!analyticsAllowed) return null;

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          // 2026-05-17 GDPR:Script 注入到这里时用户已经同意 analytics,
          // 但显式声明 consent 状态对 Google Tag Assistant 调试和 ad/analytics 区分都更清晰
          gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          gtag('config', '${gaId}', {
            // 默认开启 Enhanced Measurement(GA4 后台已勾):
            // 自动追踪 page_view / scroll / outbound click / file download / video / form
            // user_id 由 useEffect 在 Clerk auth 加载完成后再 config 一次注入
          });
        `}
      </Script>
    </>
  );
}
