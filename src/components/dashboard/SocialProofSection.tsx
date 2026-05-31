"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function SocialProofSection() {
  const t = useTranslations();
  const stats = [
    { value: t("socialProof.stat1Value"), label: t("socialProof.stat1Label") },
    { value: t("socialProof.stat2Value"), label: t("socialProof.stat2Label") },
    { value: t("socialProof.stat3Value"), label: t("socialProof.stat3Label") },
    { value: t("socialProof.stat4Value"), label: t("socialProof.stat4Label") },
  ];
  return (
    <section className="as-social-proof" aria-label={t("socialProof.sectionAria")}>
      <div className="as-social-inner">
        <ul className="as-stats-row" aria-label={t("socialProof.statsAria")}>
          {stats.map((s) => (
            <li key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>

        <div className="as-cta-block">
          <h2>{t("socialProof.ctaTitle")}</h2>
          <p>{t("socialProof.ctaSub")}</p>
          <Link className="as-cta-primary" href="#anyslide-prompt">
            ✦ &nbsp;{t("socialProof.ctaButton")}
          </Link>
        </div>
      </div>
    </section>
  );
}
