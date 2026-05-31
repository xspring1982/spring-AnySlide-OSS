// POST /api/stripe/portal
//
// 给已订阅用户开 Stripe Billing Portal session 自助管理订阅(取消 / 改卡 / 看发票)。
// 不需要参数,前端直接 fetch 后 window.location.href = url。
// 参考自 scaffolds/template-StickShow/api/stripe/create-portal-link。

import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";

const DEV_USER_ID = "user_dev_anonymous";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "stripe 未配置" }, { status: 503 });
  }

  let userId: string = DEV_USER_ID;
  let email: string | null = "user_dev_anonymous@dev.local";
  try {
    const a = await auth();
    if (a.userId) {
      userId = a.userId;
      const u = await currentUser();
      email =
        u?.primaryEmailAddress?.emailAddress ?? u?.emailAddresses[0]?.emailAddress ?? null;
    }
  } catch {
    /* dev fallback */
  }
  if (!email) {
    return Response.json({ error: "缺 email" }, { status: 400 });
  }

  // 找映射的 stripe customer
  const rows = (await sql`
    SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ${userId} LIMIT 1
  `) as Array<{ stripe_customer_id: string }>;
  if (rows.length === 0) {
    return Response.json(
      { error: "尚未购买过任何商品,请先充值或订阅" },
      { status: 404 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.APP_URL ??
    `http://${req.headers.get("host") ?? "localhost:3000"}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${origin}/billing`,
  });
  return Response.json({ url: session.url });
}
