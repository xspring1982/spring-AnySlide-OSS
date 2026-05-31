// 邮件模板 — 业务语义化函数
//
// MVP 阶段:全部英文(国际化产品默认),Phase 2 加多语言(参见 docs/todo.md T2-EMAIL-I18N)
//
// 多语言难点:邮件由 Clerk webhook(server-to-server)触发,没有 request locale。
// Phase 2 方案:sign-up 时把 locale 写到 Clerk public_metadata,webhook 读出后选模板。
//
// 所有调用业务都走这里(welcomeEmail / taskDoneEmail / freeCreditExpireEmail),
// 不直接调底层 sendEmail。这样后期改模板只在一个地方。
//
// 模板风格:简洁 HTML(无外部 CSS,所有样式 inline),
// 头部品牌色 #C96B35,匹配 AnySlide 主色

import { sendEmail, type SendEmailResult } from "./resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL ||
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
  "support@example.com";
const BRAND_COLOR = "#C96B35";

/**
 * 公用 HTML 包装器:头部 logo + 品牌色,正文段落,底部联系
 */
function wrap(content: string, opts?: { footerExtra?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AnySlide</title>
</head>
<body style="margin:0;padding:0;background:#ECECEC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#1F1F1F;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ECECEC;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;border:2px solid #1F1F1F;box-shadow:4px 4px 0 #1F1F1F;overflow:hidden;">
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;color:#fff;">
          <div style="font-size:22px;font-weight:700;letter-spacing:-.01em;">AnySlide</div>
          <div style="font-size:13px;opacity:.85;margin-top:4px;">AI Slides · Cards · Images</div>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.7;">
          ${content}
        </td></tr>
        <tr><td style="background:#F5F5F5;padding:20px 32px;font-size:12px;color:#6B6B6B;border-top:1px solid #DCDCDC;">
          ${opts?.footerExtra || ""}
          <div style="margin-top:8px;">
            Need help? <a href="mailto:${SUPPORT_EMAIL}?subject=Support%20Request" style="color:${BRAND_COLOR};text-decoration:none;">${SUPPORT_EMAIL}</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none;">Visit AnySlide</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * 1. 注册欢迎邮件 — Clerk webhook user.created 时触发
 */
export async function sendWelcomeEmail(args: {
  to: string;
  /** 用户姓名(Clerk 拿到的 first_name 或 email 前缀) */
  name?: string;
  /** 注册赠送的积分(60 / 100 等) */
  signupCredits: number;
}): Promise<SendEmailResult> {
  const greeting = args.name ? `Hi ${args.name},` : "Hi there,";
  const html = wrap(`
    <p style="font-size:18px;font-weight:600;margin:0 0 16px;">${greeting}</p>
    <p>Welcome to <strong>AnySlide</strong> 🎉</p>
    <p>Your account is active, and we've credited you with <strong style="color:${BRAND_COLOR};font-size:18px;">${args.signupCredits}</strong> credits to get you started.</p>
    <p style="margin:24px 0;">
      Three core capabilities to try:
    </p>
    <ul style="padding-left:20px;line-height:1.9;">
      <li><strong>AI Slides</strong> — Pick a template → enter a topic → get a complete deck (38 curated styles)</li>
      <li><strong>AI Cards</strong> — Long article / link → knowledge card series (Xiaohongshu-viral aesthetic)</li>
      <li><strong>AI Images</strong> — Text-to-image with accurate CJK character rendering</li>
    </ul>
    <p style="margin:32px 0;text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:#1F1F1F;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.05em;">Get Started →</a>
    </p>
    <p style="font-size:13px;color:#6B6B6B;margin-top:24px;border-top:1px dashed #DCDCDC;padding-top:16px;">
      💡 Tip: Free users refill to 10 credits daily. We recommend starting with AI Slides — it has the richest template library.
    </p>
  `);
  return sendEmail({
    to: args.to,
    subject: `Welcome to AnySlide — ${args.signupCredits} credits inside 🎉`,
    html,
    tags: [{ name: "type", value: "welcome" }],
  });
}

/**
 * 2. 任务完成通知 — 长任务(slides 完整 deck 或 cards 多张)生成完成时触发
 *    可选用,目前只在 cron 完成 / 用户离开页面后触发(避免打扰)
 */
export async function sendTaskDoneEmail(args: {
  to: string;
  taskTitle: string;
  taskUrl: string;
  pageCount: number;
  mode: "slides" | "cards" | "image";
}): Promise<SendEmailResult> {
  const modeLabel = { slides: "slides", cards: "cards", image: "images" }[args.mode];
  const html = wrap(`
    <p style="font-size:17px;font-weight:600;margin:0 0 16px;">Your "${args.taskTitle}" is ready ✅</p>
    <p><strong>${args.pageCount}</strong> ${modeLabel} generated. Click below to view or download:</p>
    <p style="margin:32px 0;text-align:center;">
      <a href="${args.taskUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.05em;">View result →</a>
    </p>
  `);
  return sendEmail({
    to: args.to,
    subject: `[AnySlide] "${args.taskTitle}" is ready`,
    html,
    tags: [
      { name: "type", value: "task_done" },
      { name: "mode", value: args.mode },
    ],
  });
}

/**
 * 3. Free 用户图片即将过期警告(7 天后清理) — cron-cleanup 触发
 *    每天扫一次 task_files.expires_at,7 天后过期的发提醒
 */
export async function sendFreeImageExpiringEmail(args: {
  to: string;
  expiringIn: number; // 多少天后过期(通常 1-3)
  taskCount: number; // 多少个任务即将过期
}): Promise<SendEmailResult> {
  const taskWord = args.taskCount === 1 ? "project" : "projects";
  const dayWord = args.expiringIn === 1 ? "day" : "days";
  const html = wrap(`
    <p style="font-size:17px;font-weight:600;margin:0 0 16px;">⏰ ${args.taskCount} ${taskWord} expiring in ${args.expiringIn} ${dayWord}</p>
    <p>Free-tier results are auto-deleted after <strong>7 days</strong> to manage storage costs.</p>
    <p>Three ways to keep them:</p>
    <ul style="padding-left:20px;line-height:1.9;">
      <li><strong>Download locally</strong> — easiest. Use the download button on the task page.</li>
      <li><strong>Upgrade to Pro</strong> — Pro users get permanent storage (Pro launching soon).</li>
      <li><strong>Share a link</strong> — share to socials or friends. Pull a backup from R2 if needed.</li>
    </ul>
    <p style="margin:32px 0;text-align:center;">
      <a href="${APP_URL}/assets" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View my projects →</a>
    </p>
  `);
  return sendEmail({
    to: args.to,
    subject: `[AnySlide] ${args.taskCount} ${taskWord} expiring in ${args.expiringIn} ${dayWord} — please download`,
    html,
    tags: [{ name: "type", value: "expiring_warning" }],
  });
}
