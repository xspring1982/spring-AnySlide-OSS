// 公开定价页 — i18n 完整版(2026-05-05 PR 2.2b)
//
// 5 locale 共用同一组件,文案从 messages/{locale}.json 取
// JSON-LD productLd 不变(机器可读 schema,SEO 用)

import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { localizedAlternates } from "@/i18n/alternates";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd } from "@/lib/seo/structured-data";
import { isStripeConfigured } from "@/lib/stripe/client";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  const alt = localizedAlternates("/pricing", locale);
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: alt,
    openGraph: {
      type: "website",
      url: alt.canonical,
      siteName: "AnySlide",
      title: t("title"),
      description: t("subtitle"),
      images: [
        { url: "/opengraph-image", width: 1200, height: 630, alt: "AnySlide" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("subtitle"),
      images: ["/opengraph-image"],
    },
  };
}

const productLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "AnySlide Pro Subscription",
  image: [`${APP_URL}/opengraph-image`],
  description:
    "AnySlide Pro subscription with 1,000 credits per month, unlocking all 38 slide templates and 12 image generation styles.",
  brand: { "@type": "Brand", name: "AnySlide" },
  offers: [
    { "@type": "Offer", name: "Pro Monthly", price: "9.9", priceCurrency: "USD",
      availability: "https://schema.org/InStock", url: `${APP_URL}/pricing` },
    { "@type": "Offer", name: "Pro Yearly", price: "99", priceCurrency: "USD",
      availability: "https://schema.org/InStock", url: `${APP_URL}/pricing` },
    { "@type": "Offer", name: "Top-up $5", price: "5", priceCurrency: "USD",
      availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Top-up $20 (+10%)", price: "20", priceCurrency: "USD",
      availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Top-up $50 (+20%)", price: "50", priceCurrency: "USD",
      availability: "https://schema.org/InStock" },
  ],
};

interface PlanData {
  id: "free" | "pro_monthly" | "pro_yearly";
  priceCny: string;
  highlight?: boolean;
  originalPrice?: string;
  i18nNs: "free" | "proMonthly" | "proYearly";
  features: string[]; // i18n keys (relative to plan namespace)
  highlightFeatures: string[]; // which feature keys are highlighted
}

const PLANS: PlanData[] = [
  {
    id: "free",
    priceCny: "¥0",
    i18nNs: "free",
    features: ["feature1", "feature2", "feature3", "feature4", "feature5"],
    highlightFeatures: [],
  },
  {
    id: "pro_monthly",
    priceCny: "$9.9",
    originalPrice: "$19.9",
    highlight: true,
    i18nNs: "proMonthly",
    features: ["feature1", "feature2", "feature3", "feature4", "feature5", "feature6"],
    highlightFeatures: ["feature1"],
  },
  {
    id: "pro_yearly",
    priceCny: "$99",
    originalPrice: "$199",
    i18nNs: "proYearly",
    features: ["feature1", "feature2", "feature3", "feature4", "feature5"],
    highlightFeatures: ["feature1", "feature3"],
  },
];

interface TopupTier {
  id: "topup_5" | "topup_20" | "topup_50";
  cny: string;
  usd: string;
  creditsKey: string;
  descKey: string;
  badgeKey?: string;
}

const TOPUPS: TopupTier[] = [
  { id: "topup_5",  cny: "¥35",  usd: "$5",  creditsKey: "tier5Credits",  descKey: "tier5Desc" },
  { id: "topup_20", cny: "¥140", usd: "$20", creditsKey: "tier20Credits", descKey: "tier20Desc", badgeKey: "tier20Badge" },
  { id: "topup_50", cny: "¥350", usd: "$50", creditsKey: "tier50Credits", descKey: "tier50Desc", badgeKey: "tier50Badge" },
];

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const stripeOn = isStripeConfigured();

  return (
    <main className="min-h-screen bg-main-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <JsonLd
        data={breadcrumbLd(locale, [
          { name: t("nav.home"), path: "/" },
          { name: t("nav.pricing"), path: "/pricing" },
        ])}
      />
      <header className="h-14 flex items-center px-6 border-b border-outline-variant/30 bg-white/70 backdrop-blur-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[14px] text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span aria-hidden>←</span>
          <span>{t("nav.backHome")}</span>
        </Link>
      </header>

      <section className="max-w-[1200px] mx-auto px-6 pt-6 pb-3 text-center">
        <h1 className="font-h1 text-[32px] text-on-surface mb-1">{t("pricing.title")}</h1>
        <p className="text-[13px] text-on-surface-variant max-w-[640px] mx-auto">
          {t("pricing.subtitle")}
        </p>
      </section>

      {!stripeOn && (
        <section className="max-w-[1200px] mx-auto px-6 pb-2 text-center">
          <div className="inline-block rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-[13px] text-amber-800">
            {t("pricing.comingSoonBanner")}
          </div>
        </section>
      )}

      {/* 三个套餐 */}
      <section className="max-w-[1200px] mx-auto px-6 pb-3 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {PLANS.map((plan) => {
          const isPaidPlan = plan.id !== "free";
          const disabled = isPaidPlan && !stripeOn;
          const planNs = `pricing.${plan.i18nNs}`;
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-5 flex flex-col ${
                plan.highlight
                  ? "bg-primary-cta text-on-primary shadow-2xl ring-2 ring-primary-cta/30"
                  : "bg-white border border-outline-variant/30 shadow-sm"
              } ${disabled ? "opacity-75" : ""}`}
            >
              {plan.highlight && !disabled && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-on-surface text-white text-[11px] font-medium tracking-wide shadow-md whitespace-nowrap">
                  {t(`${planNs}.popular`)}
                </span>
              )}
              {disabled && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium tracking-wide shadow-md whitespace-nowrap border border-amber-300">
                  {plan.i18nNs === "free" ? t("pricing.free.cta") : t(`${planNs}.comingSoon`)}
                </span>
              )}
              <div className="mb-2">
                <h2 className={`font-h2 text-[18px] mb-0.5 ${plan.highlight ? "text-on-primary" : "text-on-surface"}`}>
                  {t(`${planNs}.name`)}
                </h2>
                <p className={`text-[12px] ${plan.highlight ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                  {t(`${planNs}.description`)}
                </p>
              </div>
              {plan.originalPrice && (
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-[16px] line-through ${plan.highlight ? "text-on-primary/60" : "text-on-surface-variant/70"}`}
                  >
                    {t(`${planNs}.originalPriceLabel`)} {plan.originalPrice}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                      plan.highlight
                        ? "bg-white text-primary-cta"
                        : "bg-error-container text-error"
                    }`}
                  >
                    {t(`${planNs}.discountLabel`)}
                  </span>
                </div>
              )}
              <div className="mb-1 flex items-baseline gap-1">
                <span className={`text-[32px] font-h1 leading-none ${plan.highlight ? "text-on-primary" : "text-on-surface"}`}>
                  {plan.priceCny}
                </span>
                <span className={`text-[13px] ${plan.highlight ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                  {t(`${planNs}.priceUnit`)}
                </span>
              </div>
              {plan.id !== "free" ? (
                <p className={`text-[11px] mb-2 ${plan.highlight ? "text-on-primary/75" : "text-on-surface-variant/80"}`}>
                  {t(`${planNs}.cnyHint`)}
                </p>
              ) : (
                <div className="mb-2" />
              )}
              <ul className="flex-1 space-y-1 mb-3">
                {plan.features.map((featKey) => {
                  const isHighlight = plan.highlightFeatures.includes(featKey);
                  return (
                    <li
                      key={featKey}
                      className={`text-[12px] flex items-start gap-1.5 ${
                        plan.highlight ? "text-on-primary/95" : "text-on-surface"
                      } ${isHighlight ? "font-medium" : ""}`}
                    >
                      <span className="shrink-0 mt-0.5">{isHighlight ? "✨" : "✓"}</span>
                      <span>{t(`${planNs}.${featKey}`)}</span>
                    </li>
                  );
                })}
              </ul>
              {disabled ? (
                <button
                  type="button"
                  disabled
                  className="block w-full text-center px-4 py-2 rounded-full text-[13px] font-medium bg-surface-container text-on-surface-variant cursor-not-allowed"
                >
                  {t(`${planNs}.comingSoon`)}
                </button>
              ) : (
                <Link
                  href={plan.id === "free" ? "/sign-up" : "/settings/billing"}
                  className={`block text-center px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                    plan.highlight
                      ? "bg-white text-primary-cta hover:bg-white/90"
                      : "bg-primary-cta text-on-primary hover:bg-primary-container"
                  }`}
                >
                  {t(`${planNs}.cta`)}
                </Link>
              )}
            </div>
          );
        })}
      </section>

      {/* 充值卡 */}
      <section className="max-w-[1200px] mx-auto px-6 pb-6">
        <div className="text-center mb-3">
          <h2 className="font-h2 text-[20px] text-on-surface mb-0.5">{t("pricing.topup.title")}</h2>
          <p className="text-[12px] text-on-surface-variant">{t("pricing.topup.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOPUPS.map((tier) => (
            <div
              key={tier.id}
              className="relative rounded-2xl bg-white border border-outline-variant/30 shadow-sm p-4 flex flex-col"
            >
              {tier.badgeKey && (
                <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                  {t(`pricing.topup.${tier.badgeKey}`)}
                </span>
              )}
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[28px] font-h1 leading-none text-on-surface">{tier.usd}</span>
                <span className="text-[12px] text-on-surface-variant">≈ {tier.cny}</span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                {t(`pricing.topup.${tier.creditsKey}`)} ·{" "}
                <span className="text-on-surface-variant/80">
                  {t(`pricing.topup.${tier.descKey}`)}
                </span>
              </p>
              {stripeOn ? (
                <Link
                  href="/settings/billing"
                  className="mt-3 block text-center px-4 py-1.5 rounded-full text-[12px] font-medium bg-on-surface text-white hover:bg-on-surface/85 transition-colors"
                >
                  {t("pricing.topup.cta")}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-3 block w-full text-center px-4 py-1.5 rounded-full text-[12px] font-medium bg-surface-container text-on-surface-variant cursor-not-allowed"
                >
                  {t("pricing.topup.comingSoon")}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-outline-variant/30 bg-white px-6 py-4 text-center text-[12px] text-on-surface-variant">
        © {new Date().getFullYear()} AnySlide ·{" "}
        <Link href="/" className="hover:underline mx-1">
          {t("nav.home")}
        </Link>
        ·
        <Link href="/pricing" className="hover:underline mx-1">
          {t("nav.pricing")}
        </Link>
        ·
        <Link href="/legal/terms" className="hover:underline mx-1">
          {t("footer.terms")}
        </Link>
        ·
        <Link href="/legal/privacy" className="hover:underline mx-1">
          {t("footer.privacy")}
        </Link>
      </footer>
    </main>
  );
}
