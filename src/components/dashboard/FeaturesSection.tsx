"use client";

import { Download, Globe, Layers, Palette, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type Feature = {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
};

const FEATURES: Feature[] = [
  { icon: Layers, titleKey: "features.f1Title", descKey: "features.f1Desc" },
  { icon: Globe, titleKey: "features.f2Title", descKey: "features.f2Desc" },
  { icon: Download, titleKey: "features.f3Title", descKey: "features.f3Desc" },
  { icon: Palette, titleKey: "features.f4Title", descKey: "features.f4Desc" },
  { icon: Zap, titleKey: "features.f5Title", descKey: "features.f5Desc" },
  { icon: Sparkles, titleKey: "features.f6Title", descKey: "features.f6Desc" },
];

export function FeaturesSection() {
  const t = useTranslations();
  return (
    <section className="as-features" id="features" aria-labelledby="features-title">
      <div className="as-features-inner">
        <div className="as-features-head">
          <h2 id="features-title">{t("features.title")}</h2>
          <p>{t("features.subtitle")}</p>
        </div>

        <div className="as-features-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <article key={f.titleKey} className="as-feature-card">
                <div className="as-feature-icon">
                  <Icon aria-hidden />
                </div>
                <h3>{t(f.titleKey as never)}</h3>
                <p>{t(f.descKey as never)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
