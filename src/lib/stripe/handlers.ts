// M4 — Stripe webhook 事件处理 + customer 维护
//
// 处理四类事件:
//   1. checkout.session.completed     一次性充值 / 订阅首单生效 → 入账积分
//   2. customer.subscription.{created,updated,deleted}  订阅状态镜像
//   3. invoice.paid                    Pro 月续费成功 → 月度赠 1000 积分
//   4. invoice.payment_failed          Pro 月续费失败 → 记录失败原因 + 托管平台日志告警
//                                      (不立即降级 plan,Stripe 会自动重试 ~1 周;
//                                       重试失败后 customer.subscription.updated 会把
//                                       status 改为 past_due → unpaid → canceled,届时
//                                       handleSubscriptionChange 会同步 plan = free)
//
// 用户需要补的:
//   - 在 Stripe dashboard 创建 5 个 Product + Price,把 price_id 填到 .env
//   - webhook endpoint 设到 {APP_URL}/api/webhooks/stripe,把 signing secret 填到 STRIPE_WEBHOOK_SECRET

import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { stripe } from "./client";
import { getProductByPriceId, type StripeProductDef } from "./config";

// ─────────────────────── customer 维护 ───────────────────────

/**
 * 拿用户对应的 stripe_customer_id;不存在则在 Stripe 端创建 + 写映射。
 * 用于 checkout / billing portal 入口。
 */
export async function ensureStripeCustomer(args: {
  userId: string;
  email: string;
}): Promise<string> {
  const existing = (await sql`
    SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ${args.userId} LIMIT 1
  `) as Array<{ stripe_customer_id: string }>;
  if (existing.length > 0) return existing[0].stripe_customer_id;

  const customer = await stripe.customers.create({
    email: args.email,
    metadata: { anyslide_user_id: args.userId },
  });

  await sql`
    INSERT INTO stripe_customers (user_id, stripe_customer_id, created_at, updated_at)
    VALUES (${args.userId}, ${customer.id}, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      updated_at = NOW()
  `;
  return customer.id;
}

/** 反查:stripe_customer_id → 我们的 user_id */
async function userIdByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  const rows = (await sql`
    SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ${stripeCustomerId} LIMIT 1
  `) as Array<{ user_id: string }>;
  return rows[0]?.user_id ?? null;
}

// ─────────────────────── 事件处理 ───────────────────────

/**
 * checkout.session.completed
 *   一次性 (mode=payment) 或订阅首期 (mode=subscription) 都会触发。
 *   一次性走入账;订阅交给 invoice.paid 入账,这里只确保 customer 映射存在。
 */
export async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<{ status: "ok" | "skipped"; reason?: string }> {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.anyslide_user_id;
  if (!userId) return { status: "skipped", reason: "no anyslide_user_id" };

  // 一次性充值:从 line_items 拿到 priceId → 查商品 → 入账
  if (session.mode === "payment") {
    // 拉详情(checkout session 默认不带 line_items)
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });
    const priceId = fullSession.line_items?.data[0]?.price?.id;
    if (!priceId) return { status: "skipped", reason: "no price_id in line_items" };

    const product = getProductByPriceId(priceId);
    if (!product || product.mode !== "payment") {
      return { status: "skipped", reason: `unknown topup price ${priceId}` };
    }

    await grantCredits({
      txId: `stripe_${event.id}`,
      idempotencyKey: `stripe_${event.id}`,
      userId,
      amount: product.credits,
      reason: "topup",
      metadata: {
        stripe_event_id: event.id,
        stripe_session_id: session.id,
        product_id: product.id,
        price_id: priceId,
      },
    });
    return { status: "ok" };
  }

  // 订阅首期:只确保 customer 已映射,实际入账由 invoice.paid 触发
  if (session.mode === "subscription") {
    const stripeCustomerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    if (stripeCustomerId) {
      await sql`
        INSERT INTO stripe_customers (user_id, stripe_customer_id, created_at, updated_at)
        VALUES (${userId}, ${stripeCustomerId}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          stripe_customer_id = EXCLUDED.stripe_customer_id,
          updated_at = NOW()
      `;
    }
    return { status: "ok" };
  }
  return { status: "skipped", reason: `unsupported mode ${session.mode}` };
}

/**
 * customer.subscription.{created,updated,deleted}
 *   把订阅状态完整快照写到 stripe_subscriptions(每次整行覆盖)。
 *   并同步 users.plan = 'pro' / 'free'。
 */
export async function handleSubscriptionChange(
  event: Stripe.Event,
): Promise<{ status: "ok" | "skipped"; reason?: string }> {
  const sub = event.data.object as Stripe.Subscription;
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await userIdByStripeCustomer(stripeCustomerId);
  if (!userId) return { status: "skipped", reason: "no user mapping for customer" };

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? "";
  const tsToDate = (s: number | null | undefined) =>
    s ? new Date(s * 1000).toISOString() : null;

  // Stripe SDK v19+ 把 current_period_* 移到 items 上
  type WithLegacyPeriod = Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const legacy = sub as WithLegacyPeriod;
  type WithItemPeriod = Stripe.SubscriptionItem & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const itemP = item as WithItemPeriod | undefined;
  const periodStart = itemP?.current_period_start ?? legacy.current_period_start ?? null;
  const periodEnd = itemP?.current_period_end ?? legacy.current_period_end ?? null;

  await sql`
    INSERT INTO stripe_subscriptions (
      id, user_id, status, price_id,
      current_period_start, current_period_end,
      cancel_at, canceled_at, trial_start, trial_end,
      metadata, created_at, updated_at
    ) VALUES (
      ${sub.id},
      ${userId},
      ${sub.status},
      ${priceId},
      ${tsToDate(periodStart)},
      ${tsToDate(periodEnd)},
      ${tsToDate(sub.cancel_at)},
      ${tsToDate(sub.canceled_at)},
      ${tsToDate(sub.trial_start)},
      ${tsToDate(sub.trial_end)},
      ${JSON.stringify(sub.metadata ?? {})}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      price_id = EXCLUDED.price_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at = EXCLUDED.cancel_at,
      canceled_at = EXCLUDED.canceled_at,
      trial_start = EXCLUDED.trial_start,
      trial_end = EXCLUDED.trial_end,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `;

  // plan 同步:active / trialing 算 pro,其他都 free
  const isActive = sub.status === "active" || sub.status === "trialing";
  await sql`
    UPDATE users SET plan = ${isActive ? "pro" : "free"}, updated_at = NOW()
    WHERE id = ${userId}
  `;
  return { status: "ok" };
}

/**
 * invoice.paid — Pro 月续费成功
 *   每月触发一次,给用户加月度赠送积分(SPEC §5.4.1 Pro 1000/月)。
 *   首期 trial 也走这条路径;续费同理。
 */
export async function handleInvoicePaid(
  event: Stripe.Event,
): Promise<{ status: "ok" | "skipped"; reason?: string }> {
  type InvoiceWithSub = Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const invoice = event.data.object as InvoiceWithSub;
  // 只处理订阅型发票
  if (invoice.billing_reason !== "subscription_cycle" && invoice.billing_reason !== "subscription_create") {
    return { status: "skipped", reason: `non-subscription invoice (${invoice.billing_reason})` };
  }
  const stripeCustomerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  if (!stripeCustomerId) return { status: "skipped", reason: "no customer" };
  const userId = await userIdByStripeCustomer(stripeCustomerId);
  if (!userId) return { status: "skipped", reason: "no user mapping" };

  // 找到这张发票上对应的订阅 priceId
  const lineWithPrice = invoice.lines.data.find((l) => {
    const lineItem = l as Stripe.InvoiceLineItem & { price?: { id?: string } | null };
    return lineItem.price?.id;
  });
  const lineItem = lineWithPrice as
    | (Stripe.InvoiceLineItem & { price?: { id?: string } | null })
    | undefined;
  const priceId = lineItem?.price?.id;
  if (!priceId) return { status: "skipped", reason: "no price_id in invoice lines" };

  const product: StripeProductDef | null = getProductByPriceId(priceId);
  if (!product || product.mode !== "subscription") {
    return { status: "skipped", reason: `unknown sub price ${priceId}` };
  }

  // 月度赠送:credits = product.credits(1000 for Pro)
  await grantCredits({
    txId: `stripe_${event.id}`,
    idempotencyKey: `stripe_${event.id}`,
    userId,
    amount: product.credits,
    reason: "subscribe",
    metadata: {
      stripe_event_id: event.id,
      stripe_invoice_id: invoice.id,
      product_id: product.id,
      price_id: priceId,
      billing_reason: invoice.billing_reason,
    },
  });
  return { status: "ok" };
}

/**
 * invoice.payment_failed — Pro 续费扣款失败
 *
 * 不立即扣权限;Stripe 默认 smart retry(~1 周内多次重试),失败完成后会发
 * customer.subscription.updated 把 status 改为 past_due/unpaid/canceled,
 * 由 handleSubscriptionChange 同步 plan = free。
 *
 * 这里只做:
 *   1. console.error 打印关键字段,托管平台日志 / Sentry 可检索
 *   2. 把失败摘要写入 stripe_subscriptions.metadata.last_payment_failure(若该订阅已入库)
 *   3. 返回 ok(已确认收到,不让 Stripe 重发 webhook)
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
): Promise<{ status: "ok" | "skipped"; reason?: string }> {
  type InvoiceWithSub = Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const invoice = event.data.object as InvoiceWithSub;
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  if (!stripeCustomerId) return { status: "skipped", reason: "no customer" };

  const userId = await userIdByStripeCustomer(stripeCustomerId);
  // 即使 user 找不到也要打日志,便于排查孤儿 customer
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  // attempt_count: Stripe 第几次尝试扣款(1=首次,>=2=重试中)
  type InvoiceWithRetry = Stripe.Invoice & {
    attempt_count?: number | null;
    next_payment_attempt?: number | null;
  };
  const inv = invoice as InvoiceWithRetry;
  const attemptCount = inv.attempt_count ?? null;
  const nextAttemptAt = inv.next_payment_attempt
    ? new Date(inv.next_payment_attempt * 1000).toISOString()
    : null;

  // 失败原因:Stripe SDK v19+ 把 charge 字段移除,通过 last_finalization_error 拿
  // (要更详细的 decline_code 可在 Stripe Dashboard 上点 invoice 看 charge)
  const failureMessage = invoice.last_finalization_error?.message ?? null;

  console.error("[stripe webhook] invoice.payment_failed", {
    event_id: event.id,
    invoice_id: invoice.id,
    customer_id: stripeCustomerId,
    subscription_id: subscriptionId,
    user_id: userId,
    attempt_count: attemptCount,
    next_attempt_at: nextAttemptAt,
    failure_message: failureMessage,
    amount_due: invoice.amount_due,
    currency: invoice.currency,
  });

  if (!userId) return { status: "skipped", reason: "no user mapping" };

  // 把失败摘要 merge 到 stripe_subscriptions.metadata.last_payment_failure
  if (subscriptionId) {
    const failurePayload = {
      at: new Date().toISOString(),
      invoice_id: invoice.id,
      attempt_count: attemptCount,
      next_attempt_at: nextAttemptAt,
      message: failureMessage,
    };
    await sql`
      UPDATE stripe_subscriptions
      SET metadata = COALESCE(metadata, '{}'::jsonb)
                     || jsonb_build_object('last_payment_failure', ${JSON.stringify(failurePayload)}::jsonb),
          updated_at = NOW()
      WHERE id = ${subscriptionId}
    `;
  }
  return { status: "ok" };
}
