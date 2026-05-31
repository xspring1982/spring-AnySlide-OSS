// Cookie Policy 页
// 2026-05-17 GDPR/ePrivacy 合规配套页面 — 列清楚每个 cookie / 第三方追踪器 + 提供"重新选择"入口
//
// 关联:
// - src/lib/consent/ConsentProvider.tsx(状态层)
// - src/components/consent/CookieBanner.tsx(banner UI)
// - /legal/privacy(主隐私政策)

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { CookieReopenButton } from "@/components/consent/CookieReopenButton";
import { localizedAlternates } from "@/i18n/alternates";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd } from "@/lib/seo/structured-data";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("legal.cookies.metaTitle"),
    description: t("legal.cookies.metaDescription"),
    alternates: localizedAlternates("/legal/cookies", locale),
  };
}

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return (
    <article
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "32px 24px 60px",
        fontSize: "15px",
        lineHeight: 1.7,
        color: "#1F1F1F",
      }}
    >
      <JsonLd
        data={breadcrumbLd(locale, [
          { name: t("nav.home"), path: "/" },
          { name: t("footer.cookies"), path: "/legal/cookies" },
        ])}
      />
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "14px",
          color: "#6B6B6B",
          textDecoration: "none",
          marginBottom: "20px",
        }}
      >
        ← 返回首页
      </Link>
      <h1 style={{ fontSize: "32px", marginBottom: "12px", fontWeight: 700 }}>
        Cookie 政策
      </h1>
      <p style={{ color: "#6B6B6B", marginBottom: "32px" }}>
        最后更新:2026 年 5 月 17 日
      </p>

      <p>
        本页说明 AnySlide 使用的 cookie 和类似技术。如果你在欧盟 / 英国
        访问本站,我们会在首次访问时弹出 cookie 同意浮窗,征求你的选择;
        其他地区也提供同样的选择入口(本页底部按钮)。
      </p>

      <h2
        style={{
          fontSize: "18px",
          marginTop: "28px",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        1. 什么是 Cookie
      </h2>
      <p>
        Cookie 是网站在你的浏览器里存储的小段文本,用于记住你的偏好、保持登录状态、
        统计访问数据等。除了 cookie,我们也会用浏览器 localStorage 实现类似功能
        (比如保存你的 cookie 同意选择本身)。
      </p>

      <h2
        style={{
          fontSize: "18px",
          marginTop: "28px",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        2. 我们使用的 Cookie 分类
      </h2>

      <h3
        style={{
          fontSize: "16px",
          marginTop: "20px",
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        2.1 必需 Cookie(无法关闭)
      </h3>
      <p style={{ marginBottom: "12px" }}>
        这些 cookie
        是网站基本运行所必需的,关闭会导致登录、付款等核心功能不可用。
        根据 ePrivacy 指令,strictly necessary cookie 不需要征求同意。
      </p>
      <CookieTable
        rows={[
          {
            name: "__session, __clerk_db_jwt 等",
            provider: "Clerk(认证服务)",
            purpose: "维持登录会话",
            retention: "会话期间 / 30 天",
          },
          {
            name: "as_cookie_consent_v1",
            provider: "AnySlide(localStorage)",
            purpose: "记住你的 cookie 同意选择本身",
            retention: "永久(直到你清除)",
          },
          {
            name: "stripe-* / __stripe_*",
            provider: "Stripe(支付,仅在付款页加载)",
            purpose: "防欺诈、维持结账流程",
            retention: "会话期间 / 1 年",
          },
          {
            name: "NEXT_LOCALE",
            provider: "AnySlide",
            purpose: "记住你的语言偏好",
            retention: "1 年",
          },
        ]}
      />

      <h3
        style={{
          fontSize: "16px",
          marginTop: "24px",
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        2.2 分析 Cookie(需要你同意)
      </h3>
      <p style={{ marginBottom: "12px" }}>
        我们使用分析 cookie 了解用户如何使用产品,以便优化体验。这些 cookie
        只在你明确同意后才会被设置。撤回同意后,我们会立即停止收集新数据。
      </p>
      <CookieTable
        rows={[
          {
            name: "_ga",
            provider: "Google Analytics 4",
            purpose: "区分独立访客",
            retention: "2 年",
          },
          {
            name: "_ga_<container-id>",
            provider: "Google Analytics 4",
            purpose: "维持会话状态",
            retention: "2 年",
          },
        ]}
      />

      <h3
        style={{
          fontSize: "16px",
          marginTop: "24px",
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        2.3 营销 Cookie(需要你同意)
      </h3>
      <p style={{ marginBottom: "12px" }}>
        目前我们<strong>不使用</strong>任何营销 / 广告追踪 cookie
        (无 Facebook Pixel、无 Google Ads、无 LinkedIn Insight)。
        此分类预留给未来可能新增的第三方,真正接入前会更新本页 + 重新征求同意。
      </p>

      <h2
        style={{
          fontSize: "18px",
          marginTop: "28px",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        3. 你的选择
      </h2>
      <p>你可以随时:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>
          <strong>接受全部</strong>:允许所有非必需 cookie
        </li>
        <li>
          <strong>仅必需</strong>:仅保留登录、付款等必需 cookie
        </li>
        <li>
          <strong>自定义</strong>:按分类选择
        </li>
        <li>
          <strong>撤回 / 修改选择</strong>:点击下方按钮重新弹出同意浮窗
        </li>
      </ul>

      <div style={{ marginTop: "16px" }}>
        <CookieReopenButton />
      </div>

      <h2
        style={{
          fontSize: "18px",
          marginTop: "28px",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        4. 浏览器层面的控制
      </h2>
      <p>
        除了在本站做选择,你也可以在浏览器设置里清除 / 屏蔽 cookie。
        但请注意,屏蔽必需 cookie 会导致登录和付款功能不可用。
        各主流浏览器的说明:
      </p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>
          <a
            href="https://support.google.com/chrome/answer/95647"
            style={{ color: "#C96B35" }}
          >
            Chrome
          </a>
        </li>
        <li>
          <a
            href="https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer"
            style={{ color: "#C96B35" }}
          >
            Firefox
          </a>
        </li>
        <li>
          <a
            href="https://support.apple.com/guide/safari/manage-cookies-sfri11471"
            style={{ color: "#C96B35" }}
          >
            Safari
          </a>
        </li>
        <li>
          <a
            href="https://support.microsoft.com/microsoft-edge"
            style={{ color: "#C96B35" }}
          >
            Edge
          </a>
        </li>
      </ul>

      <h2
        style={{
          fontSize: "18px",
          marginTop: "28px",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        5. 政策变更
      </h2>
      <p>
        新增第三方追踪器或调整分类时,我们会更新本页并提升 policy 版本号,
        触发所有用户重新征求同意。
      </p>

      <h2
        style={{
          fontSize: "18px",
          marginTop: "28px",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        6. 联系方式
      </h2>
      <p>
        对本政策有疑问请联系{" "}
        <a
          href="mailto:support@example.com?subject=Cookie 政策咨询"
          style={{ color: "#C96B35" }}
        >
          support@example.com
        </a>
        ,或查看完整的{" "}
        <Link href="/legal/privacy" style={{ color: "#C96B35" }}>
          隐私政策
        </Link>
        。
      </p>
    </article>
  );
}

function CookieTable({
  rows,
}: {
  rows: Array<{
    name: string;
    provider: string;
    purpose: string;
    retention: string;
  }>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
          marginBottom: "8px",
        }}
      >
        <thead>
          <tr style={{ background: "#F5F5F5" }}>
            <th style={cellHeader}>名称</th>
            <th style={cellHeader}>来源</th>
            <th style={cellHeader}>用途</th>
            <th style={cellHeader}>保存时长</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={cellBody}>
                <code
                  style={{
                    fontSize: "12px",
                    background: "#F0F0F0",
                    padding: "1px 4px",
                    borderRadius: "3px",
                  }}
                >
                  {r.name}
                </code>
              </td>
              <td style={cellBody}>{r.provider}</td>
              <td style={cellBody}>{r.purpose}</td>
              <td style={cellBody}>{r.retention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellHeader: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  border: "1px solid #DCDCDC",
  fontWeight: 600,
  color: "#1F1F1F",
};

const cellBody: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  border: "1px solid #DCDCDC",
  color: "#1F1F1F",
  verticalAlign: "top",
};
