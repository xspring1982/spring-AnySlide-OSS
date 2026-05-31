"use client";

// 2026-05-17:在 cookie 政策页 / 设置页提供"重新选择"按钮,触发 banner 重新弹出
// 单独抽出来是因为它需要 client(useConsent + Context),而 /legal/cookies/page.tsx 是 server component

import { useTranslations } from "next-intl";
import { useConsent } from "@/lib/consent/ConsentProvider";

export function CookieReopenButton() {
  const t = useTranslations("cookieBanner");
  const { reopen, hasDecided } = useConsent();
  return (
    <button
      type="button"
      onClick={reopen}
      style={{
        padding: "10px 18px",
        fontSize: "14px",
        fontWeight: 500,
        background: "#C96B35",
        color: "#FFFFFF",
        border: "1px solid #C96B35",
        borderRadius: "8px",
        cursor: "pointer",
      }}
    >
      {hasDecided ? t("changePrefs") : t("openBanner")}
    </button>
  );
}
