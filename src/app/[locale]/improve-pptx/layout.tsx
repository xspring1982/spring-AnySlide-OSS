// improve-pptx 路由的 metadata 容器
//
// page.tsx 是 'use client' 组件,无法导出 generateMetadata,
// 因此在此 layout 里补 canonical + hreflang alternates(title/description 继承 root layout)。

import type { Metadata } from "next";
import { localizedAlternates } from "@/i18n/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localizedAlternates("/improve-pptx", locale) };
}

export default function ImprovePptxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
