// Clerk webhook：把 user.created / user.updated / user.deleted 事件同步到 users 表
// 配置：在 Clerk dashboard 设置 webhook 端点为 {APP_URL}/api/clerk/webhook
//      并把 signing secret 填到 CLERK_WEBHOOK_SECRET 环境变量
//
// 注册流程：
//   user.created → INSERT users（默认余额 100，schema default）
//                → 写一条 signup_bonus 积分流水（审计可追）
//
// 注意：本路由在 middleware 里需要放行（公开路由）。已在 SPEC §5.1.4 公开路由清单中
//      建议跑过 svix 验签，防止伪造请求。

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';
import { grantSignupBonus } from '@/lib/credits';
import { sendWelcomeEmail } from '@/lib/email/templates';

interface ClerkUserPayload {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  username?: string | null;
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | string;
  data: ClerkUserPayload;
}

function pickPrimaryEmail(user: ClerkUserPayload): string | null {
  const list = user.email_addresses ?? [];
  if (list.length === 0) return null;
  const primary = list.find((e) => e.id === user.primary_email_address_id);
  return (primary ?? list[0]).email_address;
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('CLERK_WEBHOOK_SECRET 未配置', { status: 500 });
  }

  // svix 验签
  const headerList = await headers();
  const svixId = headerList.get('svix-id');
  const svixTimestamp = headerList.get('svix-timestamp');
  const svixSignature = headerList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('缺少 svix 头部', { status: 400 });
  }

  const body = await req.text();
  let evt: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response('验签失败', { status: 400 });
  }

  const userId = evt.data.id;

  switch (evt.type) {
    case 'user.created': {
      const email = pickPrimaryEmail(evt.data);
      if (!email) {
        return new Response('user.created 缺少 email', { status: 400 });
      }
      // 一次性邮箱拦截:不写入 users 表,不发积分。Clerk 已存了用户,
      // 但下次他登进 /api/me 会因 users 表无数据 → upsert 时再次拦,等价软封禁。
      // 上线后看真实数据如有合法用户被误伤,可以加白名单或人工解封。
      const { isDisposableEmail } = await import('@/lib/auth/anti-fraud');
      if (isDisposableEmail(email)) {
        console.warn(`[clerk-webhook] 拦截一次性邮箱注册: ${email}`);
        return Response.json({ ok: true, action: 'blocked_disposable_email' });
      }
      // INSERT users（如果重试，ON CONFLICT 跳过，避免重复加积分）
      // 初始余额 = SIGNUP_BONUS_AMOUNT (60)，与 grantSignupBonus 流水匹配
      const inserted = (await sql`
        INSERT INTO users (id, email, credit_balance, plan, created_at, updated_at)
        VALUES (${userId}, ${email}, 60, 'free', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as unknown as Array<{ id: string }>;

      // 注册赠送 60 积分流水（幂等，仅补流水不加余额）
      await grantSignupBonus(userId, `tx_signup_${userId}`);

      // 仅首次插入(非 webhook 重复触发)发欢迎邮件 — 幂等保护
      if (inserted.length > 0) {
        // 不 await:邮件失败不应阻塞 webhook 200 响应,
        // 否则 Clerk 会重试 webhook → grantSignupBonus 幂等 OK,但 INSERT inserted=[]
        // → 不再发欢迎邮件,无重复发送风险
        const name = evt.data.first_name || evt.data.username || undefined;
        sendWelcomeEmail({ to: email, name, signupCredits: 60 }).catch((e) =>
          console.error('[clerk-webhook] welcome email failed:', e),
        );
      }
      return Response.json({ ok: true, action: 'created' });
    }

    case 'user.updated': {
      const email = pickPrimaryEmail(evt.data);
      if (email) {
        await sql`
          UPDATE users SET email = ${email}, updated_at = NOW()
          WHERE id = ${userId}
        `;
      }
      return Response.json({ ok: true, action: 'updated' });
    }

    case 'user.deleted': {
      // 软删：把 email 置 NULL 标记并保留 user_id 供 task 关联
      // 注意 schema 里 email NOT NULL，因此用 sentinel 值
      await sql`
        UPDATE users
        SET email = ${`deleted-${userId}@anyslide.local`}, plan = 'free', updated_at = NOW()
        WHERE id = ${userId}
      `;
      return Response.json({ ok: true, action: 'deleted' });
    }

    default:
      return Response.json({ ok: true, ignored: evt.type });
  }
}
