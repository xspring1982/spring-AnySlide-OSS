// POST /api/webhooks/stripe
//
// Stripe webhook 入口 — 验签后分发到 handlers。
// 关键:Next.js App Router 需要 raw body 才能验签,用 req.text() 拿原文。
//
// 用户操作:
//   1. 在 Stripe dashboard → Developers → Webhooks 加 endpoint:
//      {APP_URL}/api/webhooks/stripe
//   2. 选事件:checkout.session.completed,customer.subscription.created,
//      customer.subscription.updated,customer.subscription.deleted,
//      invoice.paid,invoice.payment_failed
//   3. 把 Signing secret(whsec_xxx)填到 .env.local 的 STRIPE_WEBHOOK_SECRET

import type { NextRequest } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";
import {
  handleCheckoutCompleted,
  handleSubscriptionChange,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/handlers";

export const runtime = "nodejs"; // crypto 验签需要 node

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "stripe 未配置(STRIPE_SECRET_KEY 缺)" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "STRIPE_WEBHOOK_SECRET 未配置" }, { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return Response.json({ error: "缺 stripe-signature 头" }, { status: 400 });
  }

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verify 失败";
    return Response.json({ error: `验签失败: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const r = await handleCheckoutCompleted(event);
        return Response.json({ received: true, ...r });
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const r = await handleSubscriptionChange(event);
        return Response.json({ received: true, ...r });
      }
      case "invoice.paid": {
        const r = await handleInvoicePaid(event);
        return Response.json({ received: true, ...r });
      }
      case "invoice.payment_failed": {
        const r = await handleInvoicePaymentFailed(event);
        return Response.json({ received: true, ...r });
      }
      default:
        return Response.json({ received: true, status: "ignored", type: event.type });
    }
  } catch (err) {
    // 抛 5xx 让 Stripe 自动重试
    const msg = err instanceof Error ? err.message : "handler 失败";
    console.error("[stripe webhook]", event.type, msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
