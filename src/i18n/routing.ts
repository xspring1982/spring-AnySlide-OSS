// next-intl routing config(2026-05-05 PR 2 i18n 基础设施)
//
// 5 种语言,英文为默认(全球 SaaS 标准 + SEO canonical 在 /)
// localePrefix: 'as-needed' = 默认 locale(en)URL 不带前缀,其他必须前缀:
//   - /pricing       → 英文定价页(URL 完全不变,SEO canonical)
//   - /zh/pricing    → 简体中文定价页(短 URL,仿 raphael.app)
//   - /zh-TW/pricing → 繁体中文定价页
//   - /ja/pricing    → 日语定价页
//   - /ko/pricing    → 韩语定价页
//
// 中国用户体验:浏览器 Accept-Language=zh-CN → middleware 自动 redirect / → /zh
// 英文用户 → 直接 / 看英文,无 redirect
//
// next-intl 内部 zh locale 在 Accept-Language 检测时会同时匹配 zh-CN/zh-Hans/zh 等

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh", "zh-TW", "ja", "ko"] as const,
  defaultLocale: "en",
  // 默认 locale 不显示前缀,其他必须前缀(SEO + 全球用户 / 是英文)
  localePrefix: "as-needed",
  // 浏览器 Accept-Language 自动检测 → 重定向到对应 locale(只在访问根路径时)
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

/** 用户友好的语言名(每个语言都用该国语言显示,仿 raphael.app) */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
};
