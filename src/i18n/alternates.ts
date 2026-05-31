// 本地化 alternates(canonical + hreflang languages)生成器
//
// 把 localePrefix='as-needed' 的前缀规则收口到一处:默认 locale(en)不带前缀,
// 其他 locale 带 /{locale} 前缀。供各页 generateMetadata 复用,避免每页手抄 langs 逻辑。
// 仅用于非根路径(如 "/pricing"、"/legal/privacy");首页 "/" 的 alternates 在 layout.tsx 内联处理。

import { routing } from "./routing";

/**
 * @param path  不带 locale 前缀的根相对路径,如 "/pricing"、"/legal/privacy"
 * @param locale 当前页面 locale(决定 canonical 指向哪个语言版本)
 */
export function localizedAlternates(
  path: string,
  locale: string,
): { canonical: string; languages: Record<string, string> } {
  const build = (l: string) =>
    l === routing.defaultLocale ? path : `/${l}${path}`;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = build(l);
  languages["x-default"] = path;
  return { canonical: build(locale), languages };
}
