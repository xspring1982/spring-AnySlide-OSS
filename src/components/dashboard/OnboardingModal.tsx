"use client";

import { useTranslations } from "next-intl";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
  onTry: () => void;
};

export function OnboardingModal({ open, onClose, onTry }: OnboardingModalProps) {
  const t = useTranslations();
  return (
    <div className={`as-modal-layer ${open ? "as-modal-visible" : ""}`} aria-hidden={!open}>
      <article
        className="as-onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <button className="as-modal-close" type="button" aria-label={t("common.close")} onClick={onClose}>
          ×
        </button>
        <div className="as-modal-art">
          <div className="as-mini-slide">
            <h3>INSIGHT &amp; DESIGN</h3>
            <p>{t("onboarding.bodyHint")}</p>
            <div className="as-slide-image">
              <span />
            </div>
          </div>
        </div>
        <div className="as-modal-copy">
          <h2 id="onboarding-title">{t("onboarding.title")}</h2>
          <p>{t("onboarding.subtitle")}</p>
          <button className="as-try-button" type="button" onClick={onTry}>
            {t("onboarding.tryNow")}
          </button>
        </div>
      </article>
    </div>
  );
}
