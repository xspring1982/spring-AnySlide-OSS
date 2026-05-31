"use client";

// MVP 阶段:展示「适合的内容场景」12 类,不冒充用户评价。
// 等 Phase 2 真实用户数据积累后,再回填真实 testimonials(见 TODOLIST T2-42)。

import { useTranslations } from "next-intl";

type UseCase = {
  i18nKey: string; // i18n key prefix(下面用 .desc / .title / .audience)
  icon: string;
  color: string;
};

const COL1: UseCase[] = [
  { i18nKey: "useCases.knowledge", icon: "📚", color: "#c96b35" },
  { i18nKey: "useCases.reading", icon: "📖", color: "#6b8fc9" },
  { i18nKey: "useCases.course", icon: "🎓", color: "#4a9c7e" },
  { i18nKey: "useCases.curated", icon: "🗂", color: "#9b6bc9" },
];
const COL2: UseCase[] = [
  { i18nKey: "useCases.career", icon: "💼", color: "#c9a63b" },
  { i18nKey: "useCases.beauty", icon: "💄", color: "#c96b35" },
  { i18nKey: "useCases.wellness", icon: "🥗", color: "#6b8fc9" },
  { i18nKey: "useCases.recipe", icon: "🍳", color: "#c96b7a" },
];
const COL3: UseCase[] = [
  { i18nKey: "useCases.seasonal", icon: "🌸", color: "#4a9c7e" },
  { i18nKey: "useCases.data", icon: "📊", color: "#9b6bc9" },
  { i18nKey: "useCases.team", icon: "📣", color: "#c9a63b" },
  { i18nKey: "useCases.style", icon: "✨", color: "#4a9c7e" },
];

function UseCaseCard({ uc }: { uc: UseCase }) {
  const t = useTranslations();
  return (
    <div className="as-testimonial-card">
      <p>{t(`${uc.i18nKey}.desc` as never)}</p>
      <div className="as-testimonial-author">
        <div
          className="as-testimonial-avatar"
          style={{ background: uc.color, fontSize: "20px" }}
          aria-hidden
        >
          {uc.icon}
        </div>
        <div>
          <strong>{t(`${uc.i18nKey}.title` as never)}</strong>
          <span>{t(`${uc.i18nKey}.audience` as never)}</span>
        </div>
      </div>
    </div>
  );
}

function UseCaseColumn({ items, cls }: { items: UseCase[]; cls: string }) {
  const doubled = [...items, ...items];
  return (
    <div className={`as-testimonials-col ${cls}`}>
      <div className="as-testimonials-track">
        {doubled.map((uc, i) => (
          <UseCaseCard key={i} uc={uc} />
        ))}
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const t = useTranslations();
  return (
    <section className="as-testimonials" aria-label={t("useCases.sectionAria")}>
      <div className="as-testimonials-head">
        <span className="as-section-label">{t("useCases.sectionLabel")}</span>
        <h2>{t("useCases.title")}</h2>
        <p>{t("useCases.subtitle")}</p>
      </div>

      <div className="as-testimonials-columns">
        <UseCaseColumn items={COL1} cls="as-col-slow" />
        <UseCaseColumn items={COL2} cls="as-col-mid" />
        <UseCaseColumn items={COL3} cls="as-col-fast" />
      </div>
    </section>
  );
}
