// SPEC §6.5.4 sitemap.xml + 2026-05-05 PR 2 i18n:每个公开页面 × 5 locale
//
// 自动暴露在 /sitemap.xml。next-intl localePrefix='as-needed':默认 zh-CN URL 不带前缀,
// 其他语言带前缀。每个 URL 都附 hreflang alternates 给 Google。
// 不包含:/dashboard / /task / /project / /settings / /api(私域,robots.ts 一并 disallow)

import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** localePrefix='as-needed':默认 locale 不加前缀;其他加 /<locale> */
function localizedPath(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path}`;
}

interface PageMeta {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

const PAGES: PageMeta[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/landing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/improve-pptx", changeFrequency: "monthly", priority: 0.7 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/refund", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/cookies", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];
  for (const page of PAGES) {
    // 每个 page × 每个 locale 都是一个独立 entry,自带 alternates
    const alternates: Record<string, string> = {};
    for (const l of routing.locales) {
      alternates[l] = base + localizedPath(l, page.path);
    }
    alternates["x-default"] = base + page.path;

    for (const l of routing.locales) {
      entries.push({
        url: base + localizedPath(l, page.path),
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages: alternates },
      });
    }
  }
  return entries;
}
