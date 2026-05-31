// 服务条款 (Terms of Service)
// 2026-05-04 stub 版本 — 上线前用,后续找律师正式审核
//
// 改动说明:
// 这是一个独立开发者起步阶段的 SaaS 通用模板,涵盖了 Terms of Service 的基本盘:
// 服务描述 / 用户义务 / 知识产权 / 免责 / 终止 / 变更条款。
// 真要严肃做(到了用户/付费规模),建议:
// 1. 用 termly.io / iubenda 等服务自动生成(月费 ~$10)
// 2. 找懂 SaaS 的律师 review($300-500 一次)

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
    title: t("legal.terms.metaTitle"),
    description: t("legal.terms.metaDescription"),
    alternates: localizedAlternates("/legal/terms", locale),
  };
}

export default async function TermsPage({
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
          { name: t("footer.terms"), path: "/legal/terms" },
        ])}
      />
      <Link
        href="/"
        style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "14px", color: "#6B6B6B", textDecoration: "none", marginBottom: "20px" }}
      >
        ← 返回首页
      </Link>
      <h1 style={{ fontSize: "32px", marginBottom: "12px", fontWeight: 700 }}>服务条款</h1>
      <p style={{ color: "#6B6B6B", marginBottom: "32px" }}>最后更新:2026 年 5 月 4 日</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>1. 接受条款</h2>
      <p>欢迎使用 AnySlide(以下简称&quot;本服务&quot;)。本服务由独立开发者运营。当你注册账号、访问或使用本服务,即表示你已阅读、理解并同意本《服务条款》以及《隐私政策》的全部内容。如果你不同意,请勿使用本服务。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>2. 服务说明</h2>
      <p>AnySlide 是一个 AI 内容生成工具,提供以下能力:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>AI 幻灯片生成(HTML 模板 + AI 图像两种路径)</li>
        <li>AI 单图生成(中文文字精准嵌入图像)</li>
      </ul>
      <p>我们使用第三方 AI 服务商(包括但不限于 OpenAI、Anthropic、DeepSeek 等)提供底层模型能力,生成结果由这些模型产生,我们不保证其绝对准确性、完整性或适用于特定用途。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>3. 账户与积分</h2>
      <p>使用本服务需要注册账号。你应当:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>提供真实有效的邮箱(我们会发送账号通知和重要更新)</li>
        <li>对账号下的所有操作和生成内容负责</li>
        <li>不得使用一次性邮箱、虚假身份或脚本批量注册</li>
        <li>不得共享账号给他人使用</li>
      </ul>
      <p>新用户注册赠送积分作为试用,具体数量见注册页面公告(数量我们保留调整权利)。免费账户每日积分会自动重置。积分用于消耗 AI 调用,不可提现、不可转赠。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>4. 用户内容与知识产权</h2>
      <p><strong>你输入的内容</strong>(主题文字、上传文件等)的所有权归你。我们仅在为你提供服务的范围内处理,不会用于训练我们或第三方的模型,不会出售给第三方。</p>
      <p><strong>AI 生成的内容</strong>(幻灯片 / 卡片 / 图片)的版权归你所有,你可以自由使用、修改、商用。但我们提醒:AI 生成的内容可能在罕见情况下与已有作品相似,你应自行评估法律风险,本服务对此不承担责任。</p>
      <p><strong>本服务的商标、品牌素材和未另行授权的托管服务内容</strong>归 AnySlide 或相应权利人所有。开源代码的使用以仓库根目录 LICENSE 为准。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>5. 禁止行为</h2>
      <p>使用本服务时,你不得:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>生成违反中华人民共和国法律或所在地区法律的内容(包括但不限于色情、暴力、仇恨言论、违法活动指南等)</li>
        <li>侵犯他人知识产权、肖像权、名誉权</li>
        <li>使用脚本 / 机器人批量调用,绕过限流或人机验证</li>
        <li>对本服务进行反向工程、扫描漏洞、渗透测试</li>
        <li>转售本服务的 API 调用或包装为竞品</li>
      </ul>
      <p>违反上述行为,我们有权立即终止你的账号,扣除剩余积分不予退款,并保留追究法律责任的权利。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>6. 免责声明</h2>
      <p>本服务&quot;按现状&quot;提供。在适用法律允许的最大范围内,我们不对以下情形负责:</p>
      <ul style={{ paddingLeft: "24px" }}>
        <li>AI 生成结果的准确性、完整性、适用性</li>
        <li>因第三方服务(AI 模型、对象存储、托管平台、支付平台等)中断导致的服务不可用</li>
        <li>因网络问题、用户设备问题导致的访问失败</li>
        <li>用户使用 AI 生成内容产生的任何后果</li>
      </ul>
      <p>本服务在任何情况下的最大赔偿责任不超过你过去 12 个月内为本服务实际支付的费用。免费用户的最大赔偿责任为 0。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>7. 服务变更与终止</h2>
      <p>我们保留随时修改、暂停或终止本服务全部或部分功能的权利,无需事先通知。重大变更(如停止服务)我们会提前 30 天通过邮件通知。</p>
      <p>你可以随时通过 support@example.com 申请删除账号,我们会在 30 天内处理。账号删除后所有数据(包括生成结果)将不可恢复。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>8. 条款变更</h2>
      <p>我们可能不时更新本条款。重大变更我们会通过邮件或网站公告通知。你在通知后继续使用本服务,即视为接受新条款。</p>

      <h2 style={{ fontSize: "18px", marginTop: "28px", marginBottom: "12px", fontWeight: 600 }}>9. 联系方式</h2>
      <p>如对本条款有任何疑问,请联系 <a href="mailto:support@example.com?subject=服务条款咨询" style={{ color: "#C96B35" }}>support@example.com</a>。</p>

      <p style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #DCDCDC", fontSize: "13px", color: "#6B6B6B" }}>
        本条款的解释和适用受中华人民共和国法律管辖。
      </p>
    </article>
  );
}
