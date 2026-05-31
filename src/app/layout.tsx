// 2026-05-05 PR 2 i18n 重组:根 layout 仅 pass-through。
// 实际 <html>/<body>/ClerkProvider/字体/NextIntlClientProvider 全部在 [locale]/layout.tsx
// 这样每个 locale 的页面都能正确设置 <html lang="...">,SEO 友好。
// API routes / sitemap.ts / robots.ts / opengraph-image.tsx 不走 layout,本来不影响。

import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
