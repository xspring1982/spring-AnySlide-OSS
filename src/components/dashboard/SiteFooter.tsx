"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LanguagePicker } from "@/components/i18n/LanguagePicker";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

export function SiteFooter() {
  const t = useTranslations();
  const nav = [
    {
      title: t("footer.about"),
      items: [
        { label: t("footer.features"), href: "#features" },
        { label: t("footer.pricing"), href: "/pricing" },
      ],
    },
    {
      title: t("footer.product"),
      items: [
        // 2026-05-08 chore/hide-cards-module:cards 链接暂时下线
        { label: t("modes.slides"), href: "#anyslide-prompt" },
        { label: t("sidebar.templates"), href: "#templates" },
      ],
    },
  ];
  return (
    <footer className="as-site-footer">
      <div className="as-footer-inner">
        <div className="as-footer-brand">
          <div className="as-footer-brand-row">
            <BrandLogo logoSize={30} fontSize={20} />
          </div>
          <span className="as-footer-tagline">{t("footer.tagline")}</span>
          <p className="as-footer-desc">{t("footer.desc")}</p>
        </div>

        <nav className="as-footer-links" aria-label={t("footer.navAria")}>
          {nav.map((group) => (
            <div key={group.title} className="as-footer-col">
              <h4>{group.title}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    {item.href.startsWith("#") ? (
                      // 同页锚点不走 i18n Link(避免被加 locale 前缀破坏滚动)
                      <a href={item.href}>{item.label}</a>
                    ) : (
                      <Link href={item.href}>{item.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* 2026-05-10 PR25:加 LanguagePicker 平铺 5 个 anchor,
          GSC 内链分布从 5/1/1/0 变均匀,SEO 友好 */}
      <div className="as-footer-language">
        <LanguagePicker variant="footer" />
      </div>

      <div className="as-footer-bottom">
        <span>{t("footer.copyright")}</span>
        <div className="as-footer-legal">
          <Link href="/legal/privacy">{t("footer.privacy")}</Link>
          <Link href="/legal/cookies">{t("footer.cookies")}</Link>
          <Link href="/legal/terms">{t("footer.terms")}</Link>
          <Link href="/legal/refund">{t("footer.refund")}</Link>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("footer.contactSubject"))}`}>
            {t("footer.contact")}
          </a>
        </div>
      </div>
    </footer>
  );
}
