// SPEC §6.1 12.x — 防薅羊毛 + 限流(M5+ 上线必备)
//
// 1. 一次性 / 临时邮箱域名黑名单 — 注册时拦
// 2. 内存级 rate limit(单进程,serverless 重启后清零)
//    - /api/tasks POST:每用户每分钟最多 6 次(防恶意刷生成)
//    - /api/projects POST:每用户每分钟最多 12 次(防刷空 project)
//
// 注:serverless 多实例间不共享内存 — 上线后看真实数据如有需要,
// 接 Redis / KV 做分布式限流。

// ─────────────────────── 一次性邮箱黑名单 ───────────────────────
//
// T2-46(2026-05-05):从硬编码 35 域名升级到 npm 包 disposable-email-domains
// (社区维护,12 万+ 域名,涵盖 95%+ 一次性邮箱服务,跟着包升级自动更新)。
// 加上我们自己维护的中文圈高频域名补丁,合并成一个 Set 做 O(1) 查询。

import disposableDomains from "disposable-email-domains";

/** 中文圈 / 我们自己发现的不在主流包里的域名,持续补维护 */
const EXTRA_DISPOSABLE_DOMAINS = [
  "tlsbb.com",
  "uorak.com",
  "linshiyouxiang.net",
  "jichi.email",
  "24mail.chacuo.net",
];

const DISPOSABLE_DOMAINS = new Set<string>([
  ...disposableDomains,
  ...EXTRA_DISPOSABLE_DOMAINS,
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

// ─────────────────────── 内存级 rate limit ───────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

/**
 * 简单 sliding window rate limit
 * @param key 限流标识(通常 = `${endpoint}:${userId}`)
 * @param maxPerWindow 窗口内最大请求数
 * @param windowMs 窗口长度毫秒(默认 60s)
 * @returns true=放行 / false=超限
 */
export function rateLimit(
  key: string,
  maxPerWindow: number,
  windowMs = 60_000,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: maxPerWindow - 1, resetAt: fresh.resetAt };
  }
  if (b.count >= maxPerWindow) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { ok: true, remaining: maxPerWindow - b.count, resetAt: b.resetAt };
}

// 清理过期 bucket(避免内存膨胀)
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return; // 5 min
  for (const [k, b] of buckets) {
    if (now >= b.resetAt + 60_000) buckets.delete(k);
  }
  lastCleanup = now;
}

export function rateLimitWithCleanup(
  key: string,
  maxPerWindow: number,
  windowMs = 60_000,
) {
  maybeCleanup();
  return rateLimit(key, maxPerWindow, windowMs);
}
