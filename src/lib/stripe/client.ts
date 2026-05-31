// Stripe SDK 单例 — 服务端 only
// 用法:import { stripe } from '@/lib/stripe/client';
//      await stripe.checkout.sessions.create(...)

import Stripe from "stripe";

const apiKey = process.env.STRIPE_SECRET_KEY;

// 试用模式上线:STRIPE_SECRET_KEY 缺失也允许 app 启动。
// 模块加载时不 throw,只在调用 stripe.xxx 时才 throw(此前路由应已用 isStripeConfigured 守门)。
let _stripe: Stripe | null = null;
function makeStripe(): Stripe {
  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY 未配置(试用期);路由应先用 isStripeConfigured() 守门",
    );
  }
  if (!_stripe) {
    _stripe = new Stripe(apiKey, {
      // 锁版本,避免 SDK 升级带来 webhook payload 字段差异
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

// Proxy:导出形如 stripe 的对象,但首次访问任意属性时才实例化
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(makeStripe(), prop, receiver);
  },
});

export function isStripeConfigured(): boolean {
  return !!apiKey && apiKey.startsWith("sk_");
}
