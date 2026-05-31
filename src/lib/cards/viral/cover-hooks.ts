// SPEC §2.5.1 模块 1：封面钩子库（cover_hook，8 种）
//
// 每个封面卡片必须从 8 种里选 1 个 cover_hook，用于 §2.6.1 analyze.ts 输出 outline 时
// 给 index=1 的卡片附 cover_hook 字段。

import type { ViralIntensity } from "./types";

export type CoverHookId =
  | "number_promise"
  | "curiosity_gap"
  | "pain_relief"
  | "contrarian"
  | "identity_call"
  | "authority_quote"
  | "urgent_save"
  | "before_after";

export interface CoverHook {
  id: CoverHookId;
  zhName: string;
  scenario: string; // 触发场景描述
  template: string; // 标题模板（含占位符 {N} / {percentage} / {身份标签} 等）
  example: string;
}

/** SPEC §2.5.1 表格 8 行，一字不差 */
export const COVER_HOOKS: CoverHook[] = [
  {
    id: "number_promise",
    zhName: "数字利益",
    scenario: "干货 / 教程",
    template: "{N} 个/招/步 + 名词 + 利益点",
    example: "3 招让你写出爆款标题",
  },
  {
    id: "curiosity_gap",
    zhName: "悬念缺口",
    scenario: "知识 / 反常识",
    template: "{percentage} 的人都不知道的 + 名词",
    example: "99% 的人都不知道的复利秘密",
  },
  {
    id: "pain_relief",
    zhName: "痛点解决",
    scenario: "工具 / 方法",
    template: "再也不用 + 痛点行为 / 告别 + 痛点",
    example: "再也不用熬夜赶报告",
  },
  {
    id: "contrarian",
    zhName: "反常识",
    scenario: "颠覆认知",
    template: "别再 X 了！其实 + 反转",
    example: "别再背单词了！其实你需要的是...",
  },
  {
    id: "identity_call",
    zhName: "身份共鸣",
    scenario: "圈层向",
    template: "{身份标签} + 必看 / 必备 / 福音",
    example: "打工人必看：3 个摸鱼神器",
  },
  {
    id: "authority_quote",
    zhName: "权威背书",
    scenario: "学习 / 方法论",
    template: "{身份/权威} 都在用的 + 名词",
    example: "学霸都在用的笔记法",
  },
  {
    id: "urgent_save",
    zhName: "紧迫收藏",
    scenario: "速查 / 干货",
    template: "建议收藏 / 速存 + 利益描述",
    example: "建议收藏！90% 会用到的 Excel 公式",
  },
  {
    id: "before_after",
    zhName: "对比转变",
    scenario: "转变 / 成长",
    template: "从 X 到 Y / 之前 vs 现在",
    example: "从月薪 5k 到 5w：我做对了 3 件事",
  },
];

const HOOKS_BY_ID: Record<CoverHookId, CoverHook> = COVER_HOOKS.reduce(
  (acc, h) => {
    acc[h.id] = h;
    return acc;
  },
  {} as Record<CoverHookId, CoverHook>
);

export function getCoverHook(id: CoverHookId): CoverHook {
  return HOOKS_BY_ID[id];
}

// ─────────────────────── 风格强度 gate（SPEC §2.5.1 末段，核心规则）──────────────────────

/**
 * 按 viralIntensity 过滤可用钩子集：
 *  - high：8 种全可用
 *  - medium：禁用 curiosity_gap / urgent_save（避免太煽动）
 *  - low：仅 number_promise / before_after / authority_quote
 */
export function getAvailableCoverHooks(
  intensity: ViralIntensity
): CoverHookId[] {
  if (intensity === "high") {
    return COVER_HOOKS.map((h) => h.id);
  }
  if (intensity === "medium") {
    return COVER_HOOKS.filter(
      (h) => h.id !== "curiosity_gap" && h.id !== "urgent_save"
    ).map((h) => h.id);
  }
  // low
  return ["number_promise", "before_after", "authority_quote"];
}

// ─────────────────────── 内容信号 → 钩子映射（SPEC §2.5.1 钩子选择规则）──────────────────────

/**
 * SPEC §2.5.1 6 条钩子选择规则的内容信号枚举：
 *  - tutorial：教程/方法论
 *  - cognitive_flip：认知颠覆
 *  - identity：身份向
 *  - growth_story：成长故事
 *  - problem_solving：问题解决
 *  - generic：兜底
 */
export type ContentSignal =
  | "tutorial"
  | "cognitive_flip"
  | "identity"
  | "growth_story"
  | "problem_solving"
  | "generic";

/**
 * 按内容信号选钩子（SPEC §2.5.1 钩子选择规则 1-6）：
 *  1. tutorial → number_promise / authority_quote / urgent_save
 *  2. cognitive_flip → contrarian / curiosity_gap
 *  3. identity → identity_call
 *  4. growth_story → before_after
 *  5. problem_solving → pain_relief
 *  6. 兜底：number_promise（万能型）
 *
 * 然后再交给 viralIntensity gate 过滤；如全被过滤掉，回退到该 intensity 下 number_promise / 第一个可用项。
 */
export function pickCoverHook(
  signal: ContentSignal,
  intensity: ViralIntensity
): CoverHookId {
  const candidates = candidatesBySignal(signal);
  const allowed = new Set(getAvailableCoverHooks(intensity));
  const picked = candidates.find((id) => allowed.has(id));
  if (picked) return picked;

  // 候选都被 gate 过滤光：兜底 number_promise（万能型，所有 intensity 都允许）
  if (allowed.has("number_promise")) return "number_promise";
  // 极端兜底：取该 intensity 第一个可用钩子（理论不会走到，留给静态类型完整性）
  return [...allowed][0] ?? "number_promise";
}

function candidatesBySignal(signal: ContentSignal): CoverHookId[] {
  switch (signal) {
    case "tutorial":
      return ["number_promise", "authority_quote", "urgent_save"];
    case "cognitive_flip":
      return ["contrarian", "curiosity_gap"];
    case "identity":
      return ["identity_call"];
    case "growth_story":
      return ["before_after"];
    case "problem_solving":
      return ["pain_relief"];
    case "generic":
    default:
      return ["number_promise"];
  }
}
