// SEO 结构化数据(JSON-LD)构造器
//
// organizationLd:站点级 Organization,放 root layout,所有页继承(E-E-A-T 信号)。
// breadcrumbLd:每个非首页的 BreadcrumbList,item URL 按当前 locale 本地化。

import { routing } from "@/i18n/routing";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AnySlide",
  url: APP_URL,
  logo: `${APP_URL}/brand/anyslide-logo.png`,
  sameAs: ["https://github.com/xspring1982/AnySlide"],
};

/**
 * @param locale 当前页 locale(决定 item URL 是否带 /{locale} 前缀)
 * @param trail  从首页到当前页的路径,path 为不带 locale 前缀的根相对路径("/" 表示首页)
 */
export function breadcrumbLd(
  locale: string,
  trail: { name: string; path: string }[],
): Record<string, unknown> {
  const localize = (path: string) => {
    const prefixed =
      locale === routing.defaultLocale
        ? path
        : `/${locale}${path === "/" ? "" : path}`;
    return `${APP_URL}${prefixed === "" ? "/" : prefixed}`;
  };
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: localize(it.path),
    })),
  };
}
