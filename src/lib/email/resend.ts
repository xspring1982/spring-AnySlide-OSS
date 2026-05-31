// 邮件服务 — Resend 客户端
//
// 设计:
// - 单例 Resend 实例(避免每次调用重新建连)
// - 缺 API key 时,所有 send 调用变成 console.log + 不抛异常(不阻塞业务)
// - 域名验证前用 onboarding@resend.dev 测试地址(只能发给注册账号邮箱)
// - 域名验证后切到 hello@yourdomain.com / noreply@yourdomain.com
//
// env:
//   RESEND_API_KEY=re_xxx     必填(否则降级到 noop 模式)
//   RESEND_FROM_EMAIL=...     缺省用 onboarding@resend.dev(测试)
//                             生产应该用 noreply@example.com 这类自有域名地址
//   ANYSLIDE_BRAND_NAME=AnySlide

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const brandName = process.env.ANYSLIDE_BRAND_NAME || "AnySlide";

// 单例;无 key 时 client 为 null,所有 send 走 noop
const client: Resend | null = apiKey ? new Resend(apiKey) : null;

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn(
    "[email] RESEND_API_KEY 未设置,所有邮件发送降级为 console.log。" +
      "上线前请去 https://resend.com 注册并填入 .env",
  );
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  /** HTML 正文(优先) */
  html?: string;
  /** 纯文本 fallback */
  text?: string;
  /** 自定义发件人(默认用 RESEND_FROM_EMAIL) */
  from?: string;
  /** Reply-To 地址 */
  replyTo?: string;
  /** 标签:用于 Resend dashboard 分类(如 "welcome" / "task_done") */
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** noop 模式标记(无 API key) */
  skipped?: boolean;
}

/**
 * 通用发邮件入口
 * 所有业务场景应该走 src/lib/email/templates.ts 里包装好的语义化函数,
 * 而不是直接调这个底层
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  // 无 key:打 log + 不抛异常
  if (!client) {
    console.log("[email:noop]", {
      to: args.to,
      subject: args.subject,
      preview: args.html?.slice(0, 200) || args.text?.slice(0, 200),
    });
    return { ok: true, skipped: true };
  }

  if (!args.html && !args.text) {
    return { ok: false, error: "html 和 text 至少要有一个" };
  }

  try {
    // Resend SDK 用 discriminated union(html / text / react 互斥),
    // 走 html 优先 → text 兜底
    const base = {
      from: args.from || `${brandName} <${fromEmail}>`,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      replyTo: args.replyTo,
      tags: args.tags,
    };
    const result = args.html
      ? await client.emails.send({ ...base, html: args.html })
      : await client.emails.send({ ...base, text: args.text! });
    if (result.error) {
      console.error("[email:send-failed]", result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error("[email:send-threw]", err);
    return { ok: false, error: (err as Error).message };
  }
}

/** 给业务方便检测 */
export function isEmailEnabled(): boolean {
  return Boolean(apiKey);
}
