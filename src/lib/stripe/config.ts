// Stripe 价格配置 — 全平台统一 USD(2026-05-06 简化版)
//
// 历史:之前充值卡曾分 CNY + USD 双 Price,中文页走 ¥;现在全平台统一 USD,
// 中国用户在 Stripe Checkout 仍可选 Alipay / WeChat Pay 扫码(Stripe 自动按
// 当时汇率把 USD 转成 CNY 扣款),中文页 UI 旁边附 "≈ ¥X" 让用户有概念。
//
// 共 5 个 Price(由 scripts/setup-stripe-products.ts 一键生成):
//   topup_5      = $5    一次性  → 500 积分
//   topup_20     = $20   一次性  → 2200 积分(送 10%)
//   topup_50     = $50   一次性  → 6000 积分(送 20%)
//   pro_monthly  = $9.9  月订阅  → 1000 积分/月
//   pro_yearly   = $99   年订阅  → 1000 积分/月

export type StripeProductId =
  | "topup_5"
  | "topup_20"
  | "topup_50"
  | "pro_monthly"
  | "pro_yearly";

export interface StripeProductDef {
  id: StripeProductId;
  /** payment(一次性)/ subscription(订阅)*/
  mode: "payment" | "subscription";
  /** 一次性 = 直接到账积分;订阅 = 每月赠送积分 */
  credits: number;
  /** 显示名(同时给中英文展示用)*/
  name: string;
  /** 一句话描述 */
  description: string;
  /** Stripe Price ID(price_xxx),来自 process.env */
  priceId: string;
  /** 显示价格(如 "$5") */
  display: string;
  /** 最小货币单位金额(USD cents) */
  unitAmount: number;
}

export const STRIPE_PRODUCTS: Record<StripeProductId, StripeProductDef> = {
  topup_5: {
    id: "topup_5",
    mode: "payment",
    credits: 500,
    name: "入门积分包",
    description: "500 积分,约 100 张高档卡片或图片",
    priceId: process.env.STRIPE_PRICE_TOPUP_5 ?? "",
    display: "$5",
    unitAmount: 500,
  },
  topup_20: {
    id: "topup_20",
    mode: "payment",
    credits: 2200, // 送 10%
    name: "进阶积分包",
    description: "2200 积分(送 10%),约 440 张高档卡片或图片",
    priceId: process.env.STRIPE_PRICE_TOPUP_20 ?? "",
    display: "$20",
    unitAmount: 2000,
  },
  topup_50: {
    id: "topup_50",
    mode: "payment",
    credits: 6000, // 送 20%
    name: "专业积分包",
    description: "6000 积分(送 20%),约 1200 张高档卡片或图片",
    priceId: process.env.STRIPE_PRICE_TOPUP_50 ?? "",
    display: "$50",
    unitAmount: 5000,
  },
  pro_monthly: {
    id: "pro_monthly",
    mode: "subscription",
    credits: 1000,
    name: "Pro 月订阅",
    description: "每月 1000 积分 + Pro 模板 + 永久保留 + 优先生成",
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    display: "$9.9/月",
    unitAmount: 990,
  },
  pro_yearly: {
    id: "pro_yearly",
    mode: "subscription",
    credits: 1000,
    name: "Pro 年订阅",
    description: "每月 1000 积分 + Pro 模板 + 永久保留 + 年付 2 个月免费",
    priceId: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
    display: "$99/年",
    unitAmount: 9900,
  },
};

/**
 * 反向:从 priceId 找回 product(webhook 入账时用)
 */
export function getProductByPriceId(priceId: string): StripeProductDef | null {
  for (const product of Object.values(STRIPE_PRODUCTS)) {
    if (product.priceId === priceId) return product;
  }
  return null;
}
