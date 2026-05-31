// POST /api/stripe/checkout
// body: { productId: StripeProductId }
//
// 创建 Stripe Checkout Session 后返回 url,前端 window.location 跳。
// 一次性充值用 mode=payment;Pro 订阅用 mode=subscription。

import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";
import {
  STRIPE_PRODUCTS,
  type StripeProductId,
} from "@/lib/stripe/config";
import { ensureStripeCustomer } from "@/lib/stripe/handlers";
import { ensureDevUser } from "@/lib/tasks/repo";

const DEV_USER_ID = "user_dev_anonymous";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return Response.json(
      { error: "stripe 未配置,请先在 .env 设 STRIPE_SECRET_KEY + STRIPE_PRICE_*" },
      { status: 503 },
    );
  }

  let body: { productId?: StripeProductId; locale?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体解析失败" }, { status: 400 });
  }

  if (!body.productId || !(body.productId in STRIPE_PRODUCTS)) {
    return Response.json(
      { error: "productId 不合法,合法值见 STRIPE_PRODUCTS" },
      { status: 400 },
    );
  }
  const product = STRIPE_PRODUCTS[body.productId];

  // locale 仅用于 metadata / Stripe Checkout 界面语言,不再决定 priceId
  // (2026-05-06 起全平台 USD 计价;中国用户在 Checkout 上仍可扫 Alipay/WeChat)
  const acceptLang = req.headers.get("accept-language") ?? "";
  const locale = body.locale || (acceptLang.toLowerCase().startsWith("zh") ? "zh" : "en");
  if (!product.priceId) {
    return Response.json(
      {
        error: `${body.productId} 没有 Price ID,请检查 .env 是否填了对应 STRIPE_PRICE_*`,
      },
      { status: 503 },
    );
  }

  // 解析当前用户(Clerk 优先,M1-M3 dev fallback)
  let userId: string = DEV_USER_ID;
  let email: string | null = "user_dev_anonymous@dev.local";
  let isDev = true;
  try {
    const a = await auth();
    if (a.userId) {
      userId = a.userId;
      isDev = false;
      const u = await currentUser();
      email =
        u?.primaryEmailAddress?.emailAddress ??
        u?.emailAddresses[0]?.emailAddress ??
        null;
    }
  } catch {
    /* dev fallback */
  }

  if (!email) {
    return Response.json({ error: "缺 email,无法发起 checkout" }, { status: 400 });
  }

  if (isDev) {
    await ensureDevUser(DEV_USER_ID);
  } else {
    await sql`
      INSERT INTO users (id, email, credit_balance, plan, created_at, updated_at)
      VALUES (${userId}, ${email}, 100, 'free', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const customerId = await ensureStripeCustomer({ userId, email });

  const origin =
    req.headers.get("origin") ??
    process.env.APP_URL ??
    `http://${req.headers.get("host") ?? "localhost:3000"}`;

  // 支付方式(全平台 USD 计价):
  // - 订阅(月/年)→ Card only(Stripe 限制:Alipay/WeChat 不支持自动续费)
  // - 一次性充值 → Card 必开;Alipay / WeChat Pay 由 env flag 控制
  //   某些支付方式需要先在 Stripe 后台通过审核或显式启用。
  //   代码默认不带可选方式,通过后改 STRIPE_ENABLE_* 即生效。
  //   防御:Stripe 后台没 enable 某 method 时 Checkout 创建会直接 400,
  //         所以用 env flag 而不是写死。
  type PMT = NonNullable<Stripe.Checkout.SessionCreateParams["payment_method_types"]>;
  const paymentMethodTypes: PMT = (() => {
    if (product.mode === "subscription") return ["card"] as PMT;
    const methods: PMT = ["card"];
    if (process.env.STRIPE_ENABLE_ALIPAY === "true") methods.push("alipay");
    if (process.env.STRIPE_ENABLE_WECHAT_PAY === "true") methods.push("wechat_pay");
    return methods;
  })();

  const session = await stripe.checkout.sessions.create({
    mode: product.mode,
    customer: customerId,
    payment_method_types: paymentMethodTypes,
    // wechat_pay 需要 client 参数(web 浏览器选 web)
    ...(paymentMethodTypes.includes("wechat_pay") && {
      payment_method_options: {
        wechat_pay: { client: "web" },
      },
    }),
    line_items: [{ price: product.priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings/billing?status=cancel`,
    metadata: {
      anyslide_user_id: userId,
      product_id: product.id,
      currency: "usd",
      locale,
    },
    // subscription mode 推荐打开 customer_email automatic
    ...(product.mode === "subscription" && {
      subscription_data: {
        metadata: { anyslide_user_id: userId, product_id: product.id },
      },
    }),
  });

  if (!session.url) {
    return Response.json({ error: "checkout session 缺 url" }, { status: 500 });
  }
  return Response.json({ url: session.url, sessionId: session.id });
}
