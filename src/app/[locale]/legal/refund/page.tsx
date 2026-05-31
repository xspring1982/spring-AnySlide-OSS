// 退款政策 (Refund Policy)
// 2026-05-06 正式收费版(去 MVP 试用期文案)
// 2026-05-10 PR25:metadata i18n;body 暂保留中文

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
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
    title: t("legal.refund.metaTitle"),
    description: t("legal.refund.metaDescription"),
    alternates: localizedAlternates("/legal/refund", locale),
  };
}

export default async function RefundPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return (
    <article style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 24px 60px", fontSize: "15px", lineHeight: 1.7, color: "#1F1F1F" }}>
      <JsonLd
        data={breadcrumbLd(locale, [
          { name: t("nav.home"), path: "/" },
          { name: t("footer.refund"), path: "/legal/refund" },
        ])}
      />
      {/* 返回首页 */}
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "14px", color: "#6B6B6B", textDecoration: "none", marginBottom: "20px" }}
      >
        ← 返回首页
      </Link>

      <h1 style={{ fontSize: "32px", marginBottom: "12px", fontWeight: 700 }}>退款政策</h1>
      <p style={{ color: "#6B6B6B", marginBottom: "32px" }}>最后更新:2026 年 5 月 6 日</p>

      <p>我们希望你对 AnySlide 满意。如果你不满意,这里说明退款规则。所有规则均自动审核,符合条件即可申请,不符合条件请见底部&quot;人工审核&quot;渠道。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>1. 一次性积分包购买</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li><strong>未使用</strong>(未消耗任何积分):购买后 14 天内可全额退款</li>
        <li><strong>已使用</strong>:按已消耗积分比例扣除后退款剩余部分</li>
        <li><strong>14 天后</strong>:不接受退款,但积分永不过期(账号在,积分在)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>2. Pro 月订阅</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li>购买后 7 天内未使用 Pro 专属功能可全额退款</li>
        <li>已使用过 Pro 功能不接受全额退款,但可随时取消订阅(到期不再扣费)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>3. Pro 年订阅</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li>购买后 14 天内未使用 Pro 专属功能可全额退款</li>
        <li>14 天后按未使用月份比例退款(如已用 3 个月,退还剩余 9 个月)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>不退款情形</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li>违反《服务条款》被封号</li>
        <li>使用脚本批量调用、刷量、绕过限流</li>
        <li>购买后 30 天以上(无论是否使用)</li>
        <li>对 AI 生成结果的&quot;质量不满意&quot;(AI 生成有不可预期性,我们提供的是&quot;调用 AI 模型的能力&quot;,不是&quot;保证生成结果质量&quot;的承诺)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>申请方式</h2>
      <p>符合上述规则的退款,可在 <Link href="/settings/billing" style={{ color: "#C96B35" }}>账户 / 余额</Link> 页通过 Stripe Customer Portal 自助操作(订阅取消、查发票)。</p>
      <p>需要人工审核的情形(如部分退款、特殊情况),请发邮件到 <a href="mailto:support@example.com?subject=退款申请" style={{ color: "#C96B35" }}>support@example.com</a>,主题写&quot;退款申请&quot;,正文包含:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>注册邮箱(必填)</li>
        <li>订单号或购买日期</li>
        <li>退款原因(简短说明,我们用来改进产品)</li>
      </ul>
      <p>我们会在 5 个工作日内回复。审核通过后,退款会在 7-14 天内原路返回(取决于支付平台)。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>联系方式</h2>
      <p>有疑问请联系 <a href="mailto:support@example.com?subject=退款政策疑问" style={{ color: "#C96B35" }}>support@example.com</a>。</p>
    </article>
  );
}
