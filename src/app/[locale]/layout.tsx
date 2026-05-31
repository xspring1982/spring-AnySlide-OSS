// 2026-05-05 PR 2 i18n:locale 层 root layout
//
// 替代原 src/app/layout.tsx,提供:
//   - <html lang={locale}> 动态设置(SEO 友好)
//   - ClerkProvider(鉴权)
//   - next/font(Plus Jakarta + Nunito + Noto SC)
//   - NextIntlClientProvider(让客户端组件能用 useTranslations)
//   - hreflang alternates(SEO 多语言)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Noto_Sans_SC, Plus_Jakarta_Sans, Nunito_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ConsentProvider } from "@/lib/consent/ConsentProvider";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationLd } from "@/lib/seo/structured-data";

// SPEC §5.7.4 / §6.1.6 字体加载:next/font 自托管 + 子集化 + display:swap
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});
const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["800", "900"],
  display: "swap",
  variable: "--font-nunito-sans",
});
const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-sc",
});

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

/** 5 种 locale 各自的 OpenGraph locale 标识(SEO 标准是带地区的) */
const OG_LOCALE: Record<Locale, string> = {
  zh: "zh_CN",
  "zh-TW": "zh_TW",
  en: "en_US",
  ja: "ja_JP",
  ko: "ko_KR",
};

/** 2026-05-10 SEO 文案对齐外链稿口径(P1 修复)
 *  对外定位聚焦 AI 幻灯片(双引擎):HTML 路径 + gpt-image-2 整图渲染。
 *  AI 图片功能保留在站内但不在 SEO 文案上重点强调,跟 foundr.ai 等外链文案一致。
 */
const META_TITLE: Record<Locale, string> = {
  en: "AnySlide — AI Slide Deck Generator (HTML + gpt-image-2 dual engines)",
  zh: "AnySlide — AI 幻灯片生成器(HTML + gpt-image-2 双引擎)",
  "zh-TW": "AnySlide — AI 簡報生成器(HTML + gpt-image-2 雙引擎)",
  ja: "AnySlide — AI スライド生成ツール(HTML + gpt-image-2 デュアルエンジン)",
  ko: "AnySlide — AI 슬라이드 생성기 (HTML + gpt-image-2 듀얼 엔진)",
};
const META_DESCRIPTION: Record<Locale, string> = {
  en: "AnySlide is an AI slide deck generator with two engines: an HTML path that produces in-browser editable web slides, and an AI-image path powered by gpt-image-2 that renders each page as a full image with native CJK text. Paste an article, link, or PDF — get a polished deck in ~30 seconds. Also supports standalone AI image generation.",
  zh: "AnySlide 是 AI 幻灯片生成器,提供两条技术路线:HTML 路径输出可在浏览器内联编辑的网页幻灯片,AI 生图路径基于 gpt-image-2 整图渲染每一页,原生支持中日韩文字精准渲染。粘贴文章、链接或 PDF,约 30 秒生成。同时支持独立的 AI 图片生成。",
  "zh-TW": "AnySlide 是 AI 簡報生成器,提供兩條技術路線:HTML 路徑輸出可在瀏覽器內編輯的網頁簡報,AI 生圖路徑基於 gpt-image-2 整圖渲染每一頁,原生支援中日韓文字精準渲染。貼上文章、連結或 PDF,約 30 秒生成。同時支援獨立的 AI 圖片生成。",
  ja: "AnySlide は AI スライド生成ツールです。HTML パスはブラウザ内で編集可能な Web スライドを出力し、AI 画像パスは gpt-image-2 によりページ全体を画像レンダリング(中日韓文字を高精度に表示)。記事 / リンク / PDF を貼り付けるだけで、約 30 秒で完成。AI 画像の単体生成にも対応。",
  ko: "AnySlide는 AI 슬라이드 생성기입니다. HTML 경로는 브라우저에서 편집 가능한 웹 슬라이드를 출력하고, AI 이미지 경로는 gpt-image-2 로 페이지 전체를 이미지 렌더링(중일한 정밀 지원). 기사·링크·PDF 붙여넣기 후 약 30초로 생성. AI 이미지 단독 생성도 지원합니다.",
};

/** Predeclare static params — 让 Next 在 build 时知道 5 种 locale */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** 每个 locale 一套 metadata(标题 / 描述 / hreflang) */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  // SEO hreflang:让 Google 知道每个语言版本对应 URL
  // localePrefix='as-needed':default locale (zh-CN) 不带前缀,其他带前缀
  const langs: Record<string, string> = {};
  for (const l of routing.locales) {
    langs[l] = l === routing.defaultLocale ? "/" : `/${l}`;
  }
  langs["x-default"] = "/";

  const titleText = META_TITLE[locale as Locale];
  const descText = META_DESCRIPTION[locale as Locale];

  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: titleText,
      template: "%s · AnySlide",
    },
    description: descText,
    applicationName: "AnySlide",
    icons: {
      icon: "/brand/anyslide-logo-stitch-a.svg",
      apple: "/brand/anyslide-logo.png",
    },
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: langs,
    },
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale as Locale],
      url: APP_URL,
      siteName: "AnySlide",
      title: titleText,
      description: descText,
      images: [
        { url: "/opengraph-image", width: 1200, height: 630, alt: "AnySlide" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description: descText,
      images: ["/opengraph-image"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    // 禁止 Google Chrome 自动翻译。
    //   原因:我们已经原生支持 5 语言(en/zh/zh-TW/ja/ko),浏览器自动翻译会
    //   把每个文本节点包成 <font> 标签,破坏 flex / grid 布局(例如 /improve-pptx
    //   会被压成一字宽的竖列)。配合 <html translate="no"> 双重保险。
    other: {
      google: "notranslate",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // 让 SSR/RSC 知道当前 locale,后续 useTranslations() 自动取对应 messages
  setRequestLocale(locale);

  return (
    <ClerkProvider>
      <html
        lang={locale}
        translate="no"
        suppressHydrationWarning
        className={`${plusJakarta.variable} ${nunito.variable} ${notoSC.variable}`}
      >
        <body className="antialiased" suppressHydrationWarning>
          <JsonLd data={organizationLd} />
          <NextIntlClientProvider>
            <ConsentProvider>
              {children}
              <CookieBanner />
              <GoogleAnalytics />
            </ConsentProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
