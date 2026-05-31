// Stripe 一键建 Product + Price 脚本(支持 test / live 双模式)
//
// 用法:
//   npx tsx --env-file=.env.local scripts/setup-stripe-products.ts
//   npx tsx --env-file=.env.local scripts/setup-stripe-products.ts --mode=live   (上线时用)
//   npx tsx --env-file=.env.local scripts/setup-stripe-products.ts --dry-run     (只打印不建)
//
// 数据流:
//   读 STRIPE_SECRET_KEY → 调 Stripe API
//   建 5 个 Product,每个 Product 挂 1 个 USD Price,共 5 个 Price:
//     - 入门积分包 ($5,   500 积分)            一次性
//     - 进阶积分包 ($20,  2200 积分,送 10%)    一次性
//     - 专业积分包 ($50,  6000 积分,送 20%)    一次性
//     - Pro 月订阅 ($9.9, 1000 积分/月)         订阅
//     - Pro 年订阅 ($99,  12000 积分/年)        订阅
//   建完后 console 打印 5 个 env 变量,自动 append 到 .env.local
//
// 2026-05-06 简化:全平台统一 USD;中国用户在 Stripe Checkout 仍可选 Alipay / WeChat 扫码
// (Stripe 自动按当时汇率把 USD 转 CNY 扣款)
//
// 幂等:
//   如果 Product 已存在(按 metadata.anyslide_id 查),复用
//   Price 不能改价,改了会建新的(老的废弃但 Stripe 留着 — 这是 Stripe 设计)

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import Stripe from "stripe";

// ─────────────────────── 产品定义(改这里调价 / 加产品)───────────────────────

interface PriceDef {
  /** 价格(以最小货币单位:USD 是 cent,CNY 是分)*/
  unit_amount: number;
  currency: "usd" | "cny";
  /** one-time 充值 / 订阅 */
  type: "one_time" | "recurring";
  /** 订阅周期(仅 type=recurring 时用)*/
  interval?: "month" | "year";
  /** 给用户的积分(metadata,后端 webhook 入账时用)*/
  credits: number;
  /** 这个 Price 对应的 env 变量名 */
  envKey: string;
}

interface ProductDef {
  /** 内部 ID,用于 metadata.anyslide_id 防重复 */
  anyslideId: string;
  name: string;
  description: string;
  prices: PriceDef[];
}

const PRODUCTS: ProductDef[] = [
  {
    anyslideId: "topup_5",
    name: "AnySlide 入门积分包",
    description: "500 积分,约可生成 100 张高档卡片或图片(无过期)",
    prices: [
      { unit_amount: 500,  currency: "usd", type: "one_time", credits: 500, envKey: "STRIPE_PRICE_TOPUP_5" },
    ],
  },
  {
    anyslideId: "topup_20",
    name: "AnySlide 进阶积分包",
    description: "2200 积分(送 10%),约可生成 440 张高档卡片或图片(无过期)",
    prices: [
      { unit_amount: 2000,  currency: "usd", type: "one_time", credits: 2200, envKey: "STRIPE_PRICE_TOPUP_20" },
    ],
  },
  {
    anyslideId: "topup_50",
    name: "AnySlide 专业积分包",
    description: "6000 积分(送 20%),约可生成 1200 张高档卡片或图片(无过期)",
    prices: [
      { unit_amount: 5000,  currency: "usd", type: "one_time", credits: 6000, envKey: "STRIPE_PRICE_TOPUP_50" },
    ],
  },
  {
    anyslideId: "pro_monthly",
    name: "AnySlide Pro · 月订阅",
    description: "每月 1000 积分 + Pro 模板 + 永久保留 + 优先生成($9.9 ≈ ¥69)",
    prices: [
      { unit_amount: 990, currency: "usd", type: "recurring", interval: "month", credits: 1000, envKey: "STRIPE_PRICE_PRO_MONTHLY" },
    ],
  },
  {
    anyslideId: "pro_yearly",
    name: "AnySlide Pro · 年订阅",
    description: "每月 1000 积分 + Pro 模板 + 永久保留 + 优先生成($99 ≈ ¥699,年付 2 个月免费)",
    prices: [
      { unit_amount: 9900, currency: "usd", type: "recurring", interval: "year", credits: 12000, envKey: "STRIPE_PRICE_PRO_YEARLY" },
    ],
  },
];

// ─────────────────────── 主流程 ───────────────────────

async function main() {
const argv = process.argv.slice(2);
const mode: "test" | "live" =
  argv.includes("--mode=live") ? "live" : "test";
const dryRun = argv.includes("--dry-run");

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error("❌ 缺 STRIPE_SECRET_KEY,请在 .env.local 填好");
  process.exit(1);
}

// 校验 key 与 mode 一致
if (mode === "test" && !apiKey.startsWith("sk_test_")) {
  console.error(`❌ --mode=test 但 STRIPE_SECRET_KEY 不是 sk_test_ 开头(当前:${apiKey.slice(0, 8)}...)`);
  process.exit(1);
}
if (mode === "live" && !apiKey.startsWith("sk_live_")) {
  console.error(`❌ --mode=live 但 STRIPE_SECRET_KEY 不是 sk_live_ 开头(当前:${apiKey.slice(0, 8)}...)`);
  process.exit(1);
}

const stripe = new Stripe(apiKey, { apiVersion: "2026-04-22.dahlia" });

console.log(`\n═══ Stripe 建 Product + Price (${mode} mode${dryRun ? ", dry-run" : ""}) ═══\n`);

const envEntries: Record<string, string> = {};

for (const def of PRODUCTS) {
  console.log(`\n📦 ${def.name}`);

  if (dryRun) {
    for (const p of def.prices) {
      console.log(`   → ${p.envKey}=<dry-run> (${p.currency.toUpperCase()} ${(p.unit_amount / 100).toFixed(2)}, ${p.type}${p.interval ? `/${p.interval}` : ""}, ${p.credits} 积分)`);
    }
    continue;
  }

  // 1. 找 / 建 Product(按 metadata.anyslide_id 查重)
  const existing = await stripe.products.search({
    query: `metadata['anyslide_id']:'${def.anyslideId}' AND active:'true'`,
  });
  let productId: string;
  if (existing.data.length > 0) {
    productId = existing.data[0].id;
    console.log(`   ✓ Product 已存在,复用: ${productId}`);
    // 同步 name/description(可能用户改过)
    await stripe.products.update(productId, {
      name: def.name,
      description: def.description,
    });
  } else {
    const created = await stripe.products.create({
      name: def.name,
      description: def.description,
      metadata: { anyslide_id: def.anyslideId },
    });
    productId = created.id;
    console.log(`   ✓ 新建 Product: ${productId}`);
  }

  // 2. 每个 Price 查重 / 建
  for (const p of def.prices) {
    // 查 active price 是否已有同金额 + 同币种 + 同 type/interval
    const existingPrices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });
    const matched = existingPrices.data.find((ep) =>
      ep.unit_amount === p.unit_amount &&
      ep.currency === p.currency &&
      ep.type === p.type &&
      (p.type === "one_time" ||
        (ep.recurring && ep.recurring.interval === p.interval))
    );
    let priceId: string;
    if (matched) {
      priceId = matched.id;
      console.log(`     ✓ Price 已存在,复用: ${priceId} (${p.currency.toUpperCase()} ${(p.unit_amount / 100).toFixed(2)})`);
    } else {
      const created = await stripe.prices.create({
        product: productId,
        unit_amount: p.unit_amount,
        currency: p.currency,
        ...(p.type === "recurring" && p.interval && {
          recurring: { interval: p.interval },
        }),
        metadata: {
          anyslide_id: def.anyslideId,
          credits: String(p.credits),
        },
      });
      priceId = created.id;
      console.log(`     ✓ 新建 Price: ${priceId} (${p.currency.toUpperCase()} ${(p.unit_amount / 100).toFixed(2)})`);
    }
    envEntries[p.envKey] = priceId;
  }
}

// ─────────────────────── 输出 + 写 .env.local ───────────────────────

console.log("\n\n═══ 5 个 Price ID ═══\n");
for (const [k, v] of Object.entries(envEntries)) {
  console.log(`${k}=${v}`);
}

if (dryRun || mode === "live") {
console.log(`\n${dryRun ? "📋 dry-run 完成,没有真建" : "⚠️ live mode 不自动改 .env.local,请你手动复制以上行到托管平台环境变量"}`);
  process.exit(0);
}

// test mode → 自动 append / replace 到 .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  let content = readFileSync(envPath, "utf-8");
  for (const [k, v] of Object.entries(envEntries)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `${k}=${v}`);
    } else {
      content += `\n${k}=${v}`;
    }
  }
  writeFileSync(envPath, content);
  console.log(`\n✅ 已写入 ${envPath}`);
} else {
  console.log("\n⚠️ .env.local 不存在,请手动复制以上行到你的 env 文件");
}

console.log("\n下一步:");
console.log("  1. 检查 .env.local 看 5 个 STRIPE_PRICE_* 是否都填好了");
console.log("  2. 接 webhook(下一个步骤,我会帮你做)");
console.log("  3. 测试 Stripe Checkout 流程");
}

main().catch((err) => {
  console.error("\n❌ 出错:", err.message);
  process.exit(1);
});
