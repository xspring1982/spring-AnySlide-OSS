"use client";

import { useTranslations } from "next-intl";

// 2026-05-05 i18n PR 2.2b:文案改为 messages key,5 个 q/a 对
// 旧 5/6 题(内容类型 / 数据安全)在 zh.json 没列;V1 上线版精简到 6 题(q1-q6)

const FAQ_KEYS = [1, 2, 3, 4, 5, 6] as const;
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

export function FAQSection() {
  const t = useTranslations();
  return (
    <section className="as-faq" aria-labelledby="faq-title">
      <div className="as-faq-inner">
        <div className="as-faq-head">
          <h2 id="faq-title">{t("faq.title")}</h2>
          <p>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>

        <div className="as-faq-grid">
          {FAQ_KEYS.map((n) => (
            <div key={n} className="as-faq-item">
              <div className="as-faq-num">{n}</div>
              <div className="as-faq-body">
                <h3>{t(`faq.q${n}`)}</h3>
                <p>{t(`faq.a${n}`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
