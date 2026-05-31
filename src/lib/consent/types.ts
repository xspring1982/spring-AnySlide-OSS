// 2026-05-17 GDPR / ePrivacy Cookie 同意:类型层
//
// 三档分类(行业惯例,跟 cookiebot / onetrust 一致):
//   - necessary:必需(Clerk 登录会话、Stripe checkout、CSRF token),默认 ON 且无法关闭
//   - analytics:分析(Google Analytics 4),默认 OFF
//   - marketing:营销追踪(暂未接,预留扩展),默认 OFF
//
// 关联:
// - SPEC §6.5(合规与隐私)
// - src/components/analytics/GoogleAnalytics.tsx 必须读取 analytics 同意后再加载

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentChoice {
  /** 必需:始终 true(展示用,不参与判断) */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentRecord extends ConsentChoice {
  /** ISO-8601 时间戳,记录用户做出选择的时刻 */
  decidedAt: string;
  /** 协议版本号,后续 Cookie Policy 重大变更时 bump 可触发重新征求 */
  policyVersion: number;
}

/** 当前 Cookie Policy 版本。重大变更(如新接第三方追踪器)时 +1,所有用户重新征求一次。 */
export const COOKIE_POLICY_VERSION = 1;

/** localStorage key — `as_` 前缀跟项目其他 key 一致 */
export const CONSENT_STORAGE_KEY = "as_cookie_consent_v1";

/** window storage 事件用的同源广播 key,改一次 consent 后同 origin 所有 tab 立刻同步 */
export const CONSENT_CHANGE_EVENT = "as:consent-change";

export const DEFAULT_DENIED: ConsentChoice = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const DEFAULT_GRANTED: ConsentChoice = {
  necessary: true,
  analytics: true,
  marketing: true,
};

// ─────────────────────────────────────────────────────────────────────────
// 2026-05-18 Geo gate:仅 EU/EEA/UK/CH 用户弹 banner;ROW(其他地区)用户
// 默认自动 granted 不打扰转化(handoff §0 用户反馈:PR189 漏做了这一层)
// ─────────────────────────────────────────────────────────────────────────

export type GeoZone = "EU" | "ROW";

/** middleware 写到 cookie 的 key,客户端 ConsentProvider 读 */
export const GEO_COOKIE_NAME = "as_geo";

/** sessionStorage flag:用户在 /legal/cookies 显式点"重新选择"时打,
 *  让 ROW 用户也能让 banner 弹出来真正撤回同意,避免被 ROW auto-grant 死循环吞掉 */
export const REOPEN_REQUEST_KEY = "as_consent_reopen_v1";

/** EU 27 + EEA 3(IS/LI/NO)+ UK(GB)+ Switzerland(CH,有 nFADP)= 32 国
 *  覆盖最大法律范围 — UK GDPR / EU GDPR / nFADP 都需要 cookie consent */
export const EU_COUNTRIES = new Set<string>([
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA(不属 EU 但适用 GDPR)
  "IS", "LI", "NO",
  // UK GDPR + Swiss nFADP
  "GB", "CH",
]);

/** 判断 ISO 3166-1 alpha-2 国家代码是否需要 banner */
export function isEUCountry(country: string | null | undefined): boolean {
  if (!country) return true; // 未知国家保守按 EU 处理(宁可弹错也别违规)
  return EU_COUNTRIES.has(country.toUpperCase());
}
