// 隐私政策 (Privacy Policy)
// 2026-05-04 stub 版本
// 2026-05-10 PR25:metadata i18n;body 暂保留中文(法律条文 5 语言翻译需律师 review,推 Phase 2)

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
    title: t("legal.privacy.metaTitle"),
    description: t("legal.privacy.metaDescription"),
    alternates: localizedAlternates("/legal/privacy", locale),
  };
}

export default async function PrivacyPage({
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
          { name: t("footer.privacy"), path: "/legal/privacy" },
        ])}
      />
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "14px", color: "#6B6B6B", textDecoration: "none", marginBottom: "20px" }}
      >
        ← 返回首页
      </Link>
      <h1 style={{ fontSize: "32px", marginBottom: "12px", fontWeight: 700 }}>隐私政策</h1>
      <p style={{ color: "#6B6B6B", marginBottom: "32px" }}>最后更新:2026 年 5 月 4 日</p>

      <p>AnySlide 重视你的隐私。本政策说明我们如何收集、使用、存储和保护你的个人信息。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>1. 我们收集的信息</h2>

      <h3 style={{ fontSize: "15px", marginTop: "16px", marginBottom: "8px", fontWeight: 600 }}>1.1 你主动提供的</h3>
      <ul style={{ paddingLeft: "24px" }}>
        <li><strong>账号信息</strong>:邮箱(必填)、姓名、头像(Google OAuth 时自动获取)</li>
        <li><strong>支付信息</strong>:Stripe 处理(我们不接触你的信用卡号),仅记录订单 ID 和金额</li>
        <li><strong>生成内容</strong>:你输入的提示词、上传的文件、生成的图片 / 幻灯片 / 卡片</li>
      </ul>

      <h3 style={{ fontSize: "15px", marginTop: "16px", marginBottom: "8px", fontWeight: 600 }}>1.2 自动收集的</h3>
      <ul style={{ paddingLeft: "24px" }}>
        <li><strong>访问日志</strong>:IP 地址、浏览器类型、访问时间、访问的页面(用于安全监控和反薅羊毛)</li>
        <li><strong>使用数据</strong>:生成任务的次数、调用的功能、积分消耗记录(用于产品改进)</li>
        <li><strong>Cookie</strong>:用于保持登录状态、记录偏好和(在你同意后)分析访问数据。详见 <Link href="/legal/cookies" style={{ color: "#C96B35" }}>Cookie 政策</Link></li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>2. 我们如何使用信息</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li>提供 AI 生成服务(把你的提示词发给 AI 模型,把结果返还给你)</li>
        <li>账号管理(注册 / 登录 / 找回密码 / 邮件通知)</li>
        <li>计费和积分管理</li>
        <li>反薅羊毛和安全监控(检测脚本、批量注册)</li>
        <li>产品改进(分析功能使用情况,优化体验)</li>
        <li>给你发邮件(欢迎邮件、任务完成通知、过期警告等;你可以随时退订)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>3. 我们使用的第三方服务</h2>
      <p>我们使用以下第三方服务处理数据,他们各自有独立的隐私政策:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li><strong>Clerk</strong>(认证):邮箱、登录会话 — <a href="https://clerk.com/legal/privacy" style={{ color: "#C96B35" }}>政策</a></li>
        <li><strong>Neon</strong>(数据库):账号信息、生成任务记录 — <a href="https://neon.tech/privacy-policy" style={{ color: "#C96B35" }}>政策</a></li>
        <li><strong>对象存储服务</strong>:你生成的图片和导出文件</li>
        <li><strong>托管服务</strong>:访问日志和运行日志</li>
        <li><strong>Stripe</strong>(支付):支付信息 — <a href="https://stripe.com/privacy" style={{ color: "#C96B35" }}>政策</a></li>
        <li><strong>OpenAI / Anthropic / DeepSeek</strong>(AI 模型):你的提示词内容(我们关闭了这些服务的&quot;用于训练&quot;选项,但他们可能保留 30 天用于安全审查)</li>
        <li><strong>Resend</strong>(邮件):邮箱地址 — <a href="https://resend.com/legal/privacy-policy" style={{ color: "#C96B35" }}>政策</a></li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>4. 数据保留</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li><strong>账号信息</strong>:账号存活期间一直保留,删除账号后 30 天内清理</li>
        <li><strong>免费用户的生成结果</strong>:7 天后自动清理(为控制存储成本)</li>
        <li><strong>付费用户的生成结果</strong>:账号有效期间永久保留</li>
        <li><strong>访问日志</strong>:90 天</li>
        <li><strong>支付记录</strong>:法律要求保留至少 5 年(税务用)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>5. 我们不做的事</h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li><strong>不</strong>把你的数据出售给第三方</li>
        <li><strong>不</strong>用你的提示词或生成内容训练 AI 模型</li>
        <li><strong>不</strong>把你的邮箱用于第三方营销</li>
        <li><strong>不</strong>未经授权读取你的浏览器其他内容</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>6. 你的权利</h2>
      <p>你有权随时:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>查看我们持有的你的数据(联系 support@example.com)</li>
        <li>更正不准确的数据(账号设置里直接改)</li>
        <li>删除你的账号和所有相关数据</li>
        <li>导出你的生成结果(每个项目页都有下载按钮)</li>
        <li>退订营销邮件(每封邮件底部都有退订链接)</li>
      </ul>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>7. 安全措施</h2>
      <p>我们采取行业标准的安全措施保护你的数据:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>所有传输使用 HTTPS 加密</li>
        <li>密码由 Clerk 管理,我们不存储密码原文</li>
        <li>数据库连接使用 SSL</li>
        <li>API 接口有限流和身份验证</li>
        <li>定期更新依赖,扫描安全漏洞</li>
      </ul>
      <p>但请理解:互联网上没有 100% 安全。如果发生数据泄露,我们会在 72 小时内通过邮件通知你。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>8. 儿童隐私</h2>
      <p>本服务不面向 14 岁以下儿童。如果我们发现误收集了 14 岁以下儿童的数据,会立即删除。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>9. 政策变更</h2>
      <p>我们可能会更新本政策。重大变更我们会通过邮件通知。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>10. 联系方式</h2>
      <p>如对本政策有任何疑问或希望行使你的隐私权利,请联系 <a href="mailto:support@example.com?subject=隐私政策咨询" style={{ color: "#C96B35" }}>support@example.com</a>。</p>
    </article>
  );
}
