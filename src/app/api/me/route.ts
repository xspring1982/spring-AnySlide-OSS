// SPEC §5.1.3 — GET /api/me
// 返回当前用户信息:积分余额 / 订阅状态 / 模型偏好 + 最近 30 条流水(M3 新加)
//
// 上线版逻辑(2026-05-03):
//   - 未登录 → 401 { authenticated: false } (前端 sidebar / billing 用此区分游客与登录态)
//   - 真登录的 Clerk 用户首次访问(webhook 未到)→ 主动 upsert + 赠 60

import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";
import { grantSignupBonus, listRecentTransactions } from "@/lib/credits";
import { isStripeConfigured } from "@/lib/stripe/client";
import { isDisposableEmail } from "@/lib/auth/anti-fraud";

interface MeRow {
  id: string;
  email: string;
  credit_balance: number;
  credit_reset_at: string | null;
  plan: string;
  text_model_pref: string;
  image_model_pref: string;
  created_at: string;
}

export async function GET() {
  // 必须登录:未登录返回 401,前端据此切到 "登录领 60 积分" 的引导态
  let userId: string;
  try {
    const a = await auth();
    if (!a.userId) {
      return Response.json(
        { authenticated: false, error: "请先登录" },
        { status: 401 },
      );
    }
    userId = a.userId;
  } catch {
    return Response.json(
      { authenticated: false, error: "鉴权失败" },
      { status: 401 },
    );
  }

  let rows = (await sql`
    SELECT id, email, credit_balance, credit_reset_at, plan,
           text_model_pref, image_model_pref, created_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `) as unknown as MeRow[];

  // Clerk 真用户首次访问(webhook 还没到)→ 主动 upsert
  if (rows.length === 0) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return new Response("Clerk 用户不存在", { status: 401 });
    }
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null;
    if (!email) {
      return new Response("Clerk 用户缺少 email", { status: 400 });
    }
    // 一次性邮箱拦截
    if (isDisposableEmail(email)) {
      return Response.json(
        {
          authenticated: false,
          error: "暂不支持一次性邮箱,请用永久邮箱注册",
        },
        { status: 403 },
      );
    }
    // 2026-05-08 fix:之前 ON CONFLICT 只覆盖 id 冲突,但 email 也是 UNIQUE。
    // 当 Clerk 给的 userId 是新的、但 email 已经在 users 表(可能是 dev→prod 库迁
    // 移留下的孤儿记录,或同一 email 多次注册过 Clerk 不同 user)时,INSERT 抛
    // unique violation → 500 → 后续 /api/tasks 用此 userId 必然 fk violation。
    // 现在改成 ON CONFLICT (email) DO NOTHING + 检测插入是否成功;若失败说明
    // email 已被其他 userId 占用,返回 409 让用户知道,主理人手动处理 users 表。
    try {
      await sql`
        INSERT INTO users (id, email, credit_balance, plan, created_at, updated_at)
        VALUES (${userId}, ${email}, 60, 'free', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/users_email_key|duplicate key.*email/i.test(msg)) {
        console.warn(
          `[/api/me] email ${email} 已被其他 userId 占用,新 Clerk userId=${userId} 无法插入 users。`,
        );
        return Response.json(
          {
            authenticated: false,
            error:
              "该邮箱已注册过另一个账号(可能是早期注册 / 多种登录方式 / 测试残留)。请联系支持(support@example.com)合并账号,或换邮箱注册。",
            code: "EMAIL_ALREADY_REGISTERED",
          },
          { status: 409 },
        );
      }
      // 其他 DB 错误继续抛,交给运行时错误处理
      console.error("[/api/me] INSERT users 未知错误:", err);
      return Response.json(
        {
          authenticated: false,
          error: "用户初始化失败,请稍后重试",
          code: "USER_INIT_FAILED",
          debug: msg.slice(0, 300),
        },
        { status: 500 },
      );
    }
    await grantSignupBonus(userId, `tx_signup_${userId}`);
    rows = (await sql`
      SELECT id, email, credit_balance, credit_reset_at, plan,
             text_model_pref, image_model_pref, created_at
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `) as unknown as MeRow[];
  }

  if (rows.length === 0) {
    return new Response("用户不存在", { status: 404 });
  }

  const user = rows[0];
  const transactions = await listRecentTransactions(userId, 30);

  return Response.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    creditBalance: user.credit_balance,
    creditResetAt: user.credit_reset_at,
    preferences: {
      textModel: user.text_model_pref,
      imageModel: user.image_model_pref,
    },
    authenticated: true,
    stripeEnabled: isStripeConfigured(),
    createdAt: user.created_at,
    transactions: transactions.map((t) => ({
      id: t.id,
      delta: t.delta,
      reason: t.reason,
      taskId: t.taskId,
      modelUsed: t.modelUsed,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
