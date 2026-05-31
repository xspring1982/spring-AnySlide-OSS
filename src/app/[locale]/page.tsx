export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

// JSON-LD 走英文(SEO 默认 / 是英文)+ 多 inLanguage 标记
const softwareApplicationLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AnySlide",
  description:
    "AnySlide is an all-in-one AI generator for slide decks and AI images, with native CJK text rendering powered by gpt-image-2.",
  url: APP_URL,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "60 credits at sign-up, replenished daily up to 10 credits.",
    },
    {
      "@type": "Offer",
      name: "Pro Monthly",
      price: "9.9",
      priceCurrency: "USD",
      description: "1,000 credits per month, ideal for frequent creators.",
    },
  ],
  inLanguage: ["en-US", "zh-CN", "zh-TW", "ja-JP", "ko-KR"],
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return (
    <>
      <h1 className="sr-only">
        AnySlide — {t("hero.headline1")} {t("hero.headline2")}
      </h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationLd),
        }}
      />
      <FaqJsonLd />
      <DashboardHome />
    </>
  );
}
