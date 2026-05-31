-- M4 Stripe 计费 — schema 扩展
-- 跑法:DATABASE_URL=... npx tsx scripts/migrate.ts(migrate.ts 改为可指定 sql 文件后)
-- 或:psql $DATABASE_URL -f db/migrations/m4-stripe.sql

-- 1. stripe_customers — 用户 ↔ Stripe customer 一对一映射
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_cust_id ON stripe_customers(stripe_customer_id);

-- 2. stripe_subscriptions — 订阅完整状态快照(每次 webhook 整行覆盖)
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id                       TEXT PRIMARY KEY, -- subscription_id
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                   TEXT NOT NULL,
  -- trialing | active | canceled | incomplete | past_due | unpaid | paused
  price_id                 TEXT NOT NULL,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at                TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  trial_start              TIMESTAMPTZ,
  trial_end                TIMESTAMPTZ,
  metadata                 JSONB DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_subs_user ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);
