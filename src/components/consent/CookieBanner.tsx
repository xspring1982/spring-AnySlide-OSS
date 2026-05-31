"use client";

// 2026-05-17 GDPR Cookie 同意:底部浮窗 + 自定义弹窗
//
// 显示规则:
// - hydrated && !hasDecided -> 浮窗显示
// - 用户点 "接受全部" / "仅必需" / "保存自定义" 后立刻消失
// - 用户在 /legal/cookies 或 footer 点 "重新选择" -> hasDecided=false -> 浮窗再出现
//
// 设计:
// - 底部 fixed,蛋黄黑边阴影,跟设计系统的 shadow-brown 一致
// - 移动端单列,桌面端左右两列(文字 | 按钮组)
// - 自定义弹窗 modal:三档分类 + checkbox + 保存按钮
// - 内联 style 跟 SiteFooter / privacy page 风格一致(避免改全局 CSS)

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useConsent } from "@/lib/consent/ConsentProvider";

export function CookieBanner() {
  const t = useTranslations("cookieBanner");
  const { shouldShowBanner, acceptAll, rejectAll, saveCustom } = useConsent();
  const [customOpen, setCustomOpen] = useState(false);

  // 2026-05-18:渲染条件统一交给 ConsentProvider.shouldShowBanner
  // (综合 hydrated + hasDecided + geo + reopen flag,banner 只关心结果)
  if (!shouldShowBanner) return null;

  return (
    <>
      {/* 2026-05-18:紧凑版 banner — 桌面 ~50px 高单行,手机 wrap 后 ~75px,
          避免之前两行布局占据底部太多视觉空间影响观感 */}
      <div
        role="region"
        aria-label={t("ariaLabel")}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 60,
          background: "#FFFFFF",
          borderTop: "1px solid #DCDCDC",
          boxShadow: "0 -4px 24px rgba(31, 31, 31, 0.08)",
          padding: "10px 14px",
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div
            style={{
              flex: "1 1 260px",
              minWidth: 0,
              fontSize: "12px",
              lineHeight: 1.45,
              color: "#6B6B6B",
            }}
          >
            <strong style={{ color: "#1F1F1F", fontWeight: 600 }}>
              {t("title")}.
            </strong>{" "}
            {t("body")}{" "}
            <Link
              href="/legal/cookies"
              style={{
                color: "#C96B35",
                textDecoration: "underline",
                whiteSpace: "nowrap",
              }}
            >
              {t("learnMore")}
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              style={btnGhost}
            >
              {t("customize")}
            </button>
            <button type="button" onClick={rejectAll} style={btnGhost}>
              {t("rejectAll")}
            </button>
            <button type="button" onClick={acceptAll} style={btnPrimary}>
              {t("acceptAll")}
            </button>
          </div>
        </div>
      </div>

      {customOpen && (
        <CustomizeModal
          onClose={() => setCustomOpen(false)}
          onSave={(choice) => {
            saveCustom(choice);
            setCustomOpen(false);
          }}
        />
      )}
    </>
  );
}

function CustomizeModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (choice: { analytics: boolean; marketing: boolean }) => void;
}) {
  const t = useTranslations("cookieBanner");
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("customizeTitle")}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.2)",
        }}
      >
        <header style={{ padding: "20px 24px 8px" }}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#1F1F1F",
              margin: 0,
            }}
          >
            {t("customizeTitle")}
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#6B6B6B",
              margin: "6px 0 0",
              lineHeight: 1.55,
            }}
          >
            {t("customizeDesc")}
          </p>
        </header>

        <div style={{ padding: "8px 24px" }}>
          {/* Necessary - always on, disabled */}
          <CategoryRow
            label={t("catNecessary")}
            desc={t("catNecessaryDesc")}
            checked={true}
            disabled
          />
          <CategoryRow
            label={t("catAnalytics")}
            desc={t("catAnalyticsDesc")}
            checked={analytics}
            onChange={setAnalytics}
          />
          <CategoryRow
            label={t("catMarketing")}
            desc={t("catMarketingDesc")}
            checked={marketing}
            onChange={setMarketing}
          />
        </div>

        <footer
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            padding: "12px 24px 20px",
            borderTop: "1px solid #F0F0F0",
            marginTop: "8px",
          }}
        >
          <button type="button" onClick={onClose} style={btnGhost}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSave({ analytics, marketing })}
            style={btnPrimary}
          >
            {t("savePrefs")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  desc,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid #F0F0F0",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ marginTop: "3px", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#1F1F1F",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#6B6B6B",
            marginTop: "2px",
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
    </label>
  );
}

const btnBase: React.CSSProperties = {
  // 2026-05-18:紧凑化 — 减小内边距/字号/圆角,banner 整体更轻
  padding: "6px 11px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "6px",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#C96B35",
  color: "#FFFFFF",
  border: "1px solid #C96B35",
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: "#FFFFFF",
  color: "#1F1F1F",
  border: "1px solid #DCDCDC",
};
