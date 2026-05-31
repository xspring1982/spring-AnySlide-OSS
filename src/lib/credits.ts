// SPEC §5.4 — 积分操作 helper
//
// Sprint 1 范围：
//   - grantSignupBonus(userId)  注册赠 60，幂等
//   - recordTransaction(...)    通用流水记录（topup / daily_reset / refund 等）
//
// Sprint 2 + 之后扩展：
//   - chargeCredits(userId, amount, taskId, reason) 用 Pool + FOR UPDATE 行级锁
//     （SPEC §5.4.3 + §6.1 3.1 并发压测 100 用户）
//
// 重要：所有积分操作必须在同一事务里完成（余额变更 + 流水记录），
// Neon HTTP 驱动用 `sql.transaction([...])`，多语句原子执行。

import { sql } from './db';

// 注册赠送 60 积分(单档 5 积分 = 12 张 1K),首日体验完整。
// SPEC §5.4.2 — 用户决策 2026-05-02:从 100 砍到 60,日常 freeloader 成本可控。
export const SIGNUP_BONUS_AMOUNT = 60;
// Free 用户每日重置目标余额(cron-cleanup 跑)。
// 决策 2026-05-02:30→10,每天 2 张 1K,够尝鲜不至于完全 freeload。
export const FREE_DAILY_RESET_AMOUNT = 10;

export type CreditReason =
  | 'signup_bonus'
  | 'daily_reset'
  | 'topup'
  | 'subscribe'
  | 'generate'
  | 'refund_failed'
  | 'refund_cancelled';

/**
 * 给用户发注册赠送积分（幂等）。
 * 已经发过 signup_bonus 的用户跳过。
 * 该用户余额加 100 + 写流水。
 */
export async function grantSignupBonus(userId: string, txId: string): Promise<boolean> {
  // 先查是否已发过
  const existing = await sql`
    SELECT 1 FROM credit_transactions
    WHERE user_id = ${userId} AND reason = 'signup_bonus'
    LIMIT 1
  `;
  if (existing.length > 0) return false;

  // 同一事务:写流水(注意:users.credit_balance 已在 schema 默认 60,
  // 创建用户时一起 INSERT,所以这里只补流水,避免重复加)
  await sql.transaction([
    sql`
      INSERT INTO credit_transactions (id, user_id, delta, reason, created_at)
      VALUES (${txId}, ${userId}, ${SIGNUP_BONUS_AMOUNT}, 'signup_bonus', NOW())
    `,
  ]);
  return true;
}

/**
 * 通用流水记录（不改余额）。
 * 用于已经在别处改了 users.credit_balance 之后补一条审计流水。
 */
export async function recordTransaction(args: {
  id: string;
  userId: string;
  taskId?: string | null;
  delta: number;
  reason: CreditReason;
  modelUsed?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await sql`
    INSERT INTO credit_transactions (id, user_id, task_id, delta, reason, model_used, metadata, created_at)
    VALUES (
      ${args.id},
      ${args.userId},
      ${args.taskId ?? null},
      ${args.delta},
      ${args.reason},
      ${args.modelUsed ?? null},
      ${args.metadata ? JSON.stringify(args.metadata) : null},
      NOW()
    )
  `;
}

// ─────────────────────── M3.1 原子扣款 / 退款(SPEC §5.4.3) ───────────────────────

export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS" as const;
  constructor(public required: number, public balance: number) {
    super(`余额不足:需要 ${required},当前 ${balance}`);
  }
}

/**
 * 原子扣款 — UPDATE...WHERE balance >= amount RETURNING 是 Postgres 行级原子操作,
 * 单条 SQL 在 MVCC 下是串行化的(任何并发请求只能有一个成功),不需要 SELECT FOR UPDATE。
 * 余额不足直接抛 InsufficientCreditsError(不写流水),caller 决定怎么提示用户。
 *
 * SPEC §5.4 系数:
 *   cards 高档 5 / 中 3 / 低 1   (per 张)
 *   slides L1 统一 1
 *   image 高 5 / 中 3 / 低 1     (per 张)
 */
/**
 * 内部 / 测试用户白名单 — 通过 ANYSLIDE_UNLIMITED_EMAILS env 配置(逗号分隔)
 * 这些用户:跳过扣费 + 跳过余额检查 + 仍写流水(便于审计和对账)
 * 如果 env 为空,白名单为空集合
 */
const UNLIMITED_EMAILS = new Set(
  (process.env.ANYSLIDE_UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

async function isUnlimitedUser(userId: string): Promise<boolean> {
  if (UNLIMITED_EMAILS.size === 0) return false;
  const rows = (await sql`
    SELECT email FROM users WHERE id = ${userId} LIMIT 1
  `) as Array<{ email: string }>;
  const email = rows[0]?.email?.toLowerCase();
  return !!email && UNLIMITED_EMAILS.has(email);
}

export async function chargeCredits(args: {
  txId: string;
  userId: string;
  amount: number;
  reason: CreditReason;
  taskId?: string | null;
  modelUsed?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<{ newBalance: number }> {
  if (args.amount <= 0) {
    throw new Error("chargeCredits: amount 必须 > 0");
  }

  // 白名单(团队 / 测试账号):跳过扣费,只补流水方便对账
  const unlimited = await isUnlimitedUser(args.userId);
  if (unlimited) {
    await sql`
      INSERT INTO credit_transactions (id, user_id, task_id, delta, reason, model_used, metadata, created_at)
      VALUES (
        ${args.txId},
        ${args.userId},
        ${args.taskId ?? null},
        0,
        ${args.reason},
        ${args.modelUsed ?? null},
        ${args.metadata
          ? JSON.stringify({ ...args.metadata, unlimited_bypass: true, would_charge: args.amount })
          : JSON.stringify({ unlimited_bypass: true, would_charge: args.amount })},
        NOW()
      )
    `;
    const u = (await sql`SELECT credit_balance FROM users WHERE id = ${args.userId}`) as Array<{
      credit_balance: number;
    }>;
    return { newBalance: u[0]?.credit_balance ?? 0 };
  }

  const updated = (await sql`
    UPDATE users
    SET credit_balance = credit_balance - ${args.amount}, updated_at = NOW()
    WHERE id = ${args.userId} AND credit_balance >= ${args.amount}
    RETURNING credit_balance
  `) as Array<{ credit_balance: number }>;

  if (updated.length === 0) {
    const u = (await sql`SELECT credit_balance FROM users WHERE id = ${args.userId}`) as Array<{
      credit_balance: number;
    }>;
    const balance = u[0]?.credit_balance ?? 0;
    throw new InsufficientCreditsError(args.amount, balance);
  }

  const newBalance = updated[0].credit_balance;

  await sql`
    INSERT INTO credit_transactions (id, user_id, task_id, delta, reason, model_used, metadata, created_at)
    VALUES (
      ${args.txId},
      ${args.userId},
      ${args.taskId ?? null},
      ${-args.amount},
      ${args.reason},
      ${args.modelUsed ?? null},
      ${args.metadata ? JSON.stringify(args.metadata) : null},
      NOW()
    )
  `;

  return { newBalance };
}

/**
 * 反向补款(任务失败 / 取消时退还预扣的积分)。
 * 幂等:同 task_id + reason 已存在则跳过。
 */
export async function refundCredits(args: {
  txId: string;
  userId: string;
  amount: number;
  reason: "refund_failed" | "refund_cancelled";
  taskId: string;
  modelUsed?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<{ refunded: boolean; newBalance: number }> {
  if (args.amount <= 0) {
    throw new Error("refundCredits: amount 必须 > 0");
  }

  // 幂等检查
  const existing = (await sql`
    SELECT 1 FROM credit_transactions
    WHERE user_id = ${args.userId}
      AND task_id = ${args.taskId}
      AND reason = ${args.reason}
    LIMIT 1
  `) as unknown[];
  if (existing.length > 0) {
    const u = (await sql`SELECT credit_balance FROM users WHERE id = ${args.userId}`) as Array<{
      credit_balance: number;
    }>;
    return { refunded: false, newBalance: u[0]?.credit_balance ?? 0 };
  }

  const updated = (await sql`
    UPDATE users
    SET credit_balance = credit_balance + ${args.amount}, updated_at = NOW()
    WHERE id = ${args.userId}
    RETURNING credit_balance
  `) as Array<{ credit_balance: number }>;

  if (updated.length === 0) {
    throw new Error(`refundCredits: 用户 ${args.userId} 不存在`);
  }

  await sql`
    INSERT INTO credit_transactions (id, user_id, task_id, delta, reason, model_used, metadata, created_at)
    VALUES (
      ${args.txId},
      ${args.userId},
      ${args.taskId},
      ${args.amount},
      ${args.reason},
      ${args.modelUsed ?? null},
      ${args.metadata ? JSON.stringify(args.metadata) : null},
      NOW()
    )
  `;

  return { refunded: true, newBalance: updated[0].credit_balance };
}

/**
 * M4 — Stripe webhook 事件成功后,按充值 / 订阅赠款给用户加积分。
 * 幂等:idempotencyKey(stripe event_id)已存在则跳过,避免重复入账。
 */
export async function grantCredits(args: {
  txId: string;
  userId: string;
  amount: number;
  reason: "topup" | "subscribe";
  metadata?: Record<string, unknown> | null;
  /** 用 stripe event_id 做幂等,推荐用 `stripe_${event.id}` */
  idempotencyKey: string;
}): Promise<{ granted: boolean; newBalance: number }> {
  if (args.amount <= 0) {
    throw new Error("grantCredits: amount 必须 > 0");
  }

  // 幂等检查 — id = idempotencyKey(stripe event 唯一)
  const existing = (await sql`
    SELECT 1 FROM credit_transactions WHERE id = ${args.idempotencyKey} LIMIT 1
  `) as unknown[];
  if (existing.length > 0) {
    const u = (await sql`SELECT credit_balance FROM users WHERE id = ${args.userId}`) as Array<{
      credit_balance: number;
    }>;
    return { granted: false, newBalance: u[0]?.credit_balance ?? 0 };
  }

  const updated = (await sql`
    UPDATE users
    SET credit_balance = credit_balance + ${args.amount}, updated_at = NOW()
    WHERE id = ${args.userId}
    RETURNING credit_balance
  `) as Array<{ credit_balance: number }>;
  if (updated.length === 0) {
    throw new Error(`grantCredits: 用户 ${args.userId} 不存在`);
  }

  await sql`
    INSERT INTO credit_transactions (id, user_id, delta, reason, metadata, created_at)
    VALUES (
      ${args.idempotencyKey},
      ${args.userId},
      ${args.amount},
      ${args.reason},
      ${args.metadata ? JSON.stringify(args.metadata) : null},
      NOW()
    )
  `;
  return { granted: true, newBalance: updated[0].credit_balance };
}

// SPEC §5.4.1 积分系数(单模型 gpt-image-2,用户决策 2026-05-02 简化,移除中低档)。
// 后续若开放 2K/4K 高分辨率,通过 resolution 参数倍增系数,默认 1K 走 baseline 5 积分。
export type ImageResolution = "1k" | "2k" | "4k";

const RESOLUTION_MULTIPLIER: Record<ImageResolution, number> = {
  "1k": 1, // gpt-image-2 default $0.006/张
  "2k": 2, // $0.012/张
  "4k": 3, // $0.018/张
};

const CREDITS_PER_IMAGE_BASE = 5;

function creditsPerImage(resolution: ImageResolution = "1k"): number {
  return CREDITS_PER_IMAGE_BASE * RESOLUTION_MULTIPLIER[resolution];
}

export function estimateCreditsForCards(args: {
  cardCount: number;
  resolution?: ImageResolution;
}): number {
  return args.cardCount * creditsPerImage(args.resolution);
}

/** 单张重生 */
export function estimateCreditsForRegenerate(args: {
  resolution?: ImageResolution;
}): number {
  return creditsPerImage(args.resolution);
}

/** 用户当前余额(只读快照,UI 用) */
export async function getCreditBalance(userId: string): Promise<number> {
  const rows = (await sql`SELECT credit_balance FROM users WHERE id = ${userId}`) as Array<{
    credit_balance: number;
  }>;
  return rows[0]?.credit_balance ?? 0;
}

/** 最近 N 条流水(SettingsPage 用) */
export async function listRecentTransactions(
  userId: string,
  limit = 30,
): Promise<
  Array<{
    id: string;
    delta: number;
    reason: string;
    taskId: string | null;
    modelUsed: string | null;
    createdAt: Date;
  }>
> {
  const rows = (await sql`
    SELECT id, delta, reason, task_id, model_used, created_at
    FROM credit_transactions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    delta: number;
    reason: string;
    task_id: string | null;
    model_used: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    taskId: r.task_id,
    modelUsed: r.model_used,
    createdAt: new Date(r.created_at),
  }));
}
