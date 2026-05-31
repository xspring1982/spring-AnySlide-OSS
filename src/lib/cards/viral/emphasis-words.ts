// SPEC §2.5.5 模块 4：emphasis_words 强调分级
//
// 让 gpt-image-2 知道标题里哪些字要加大、加粗、加颜色。
// Claude 在 outline 里输出的 emphasis_words，会被 §2.6.4 拼装时翻译成 prompt 里的 typography 指令。

import type { CardRole, ViralIntensity } from "./types";

// SPEC §2.5.5 数据结构（一字不差）
export type EmphasisKind =
  | "number" // 数字（"3 个" / "99%"）
  | "outcome" // 利益结果（"财富自由" / "睡得更好"）
  | "identity" // 身份标签（"打工人" / "学霸"）
  | "contrarian" // 反差词（"别再" / "其实" / "万万没想到"）
  | "urgency" // 紧迫感（"立刻" / "现在" / "限时"）
  | "pain"; // 痛点关键词（"熬夜" / "加班"）

export type EmphasisWeight = "primary" | "secondary";

export interface EmphasisWord {
  text: string;
  kind: EmphasisKind;
  weight: EmphasisWeight;
}

// ─────────────────────── 选词规则（SPEC §2.5.5 选词规则 1-6）──────────────────────

/**
 * 按 kind + role 推荐 weight。SPEC §2.5.5：
 *  1. number → 永远 primary（数字是最强爆款元素）
 *  2. outcome → primary（用户为这个买单）
 *  3. contrarian → primary（反转点）
 *  4. identity → secondary（铺垫，不抢焦点）
 *  5. pain → secondary（情感引子）
 *  6. urgency → 仅 closing 卡片用，secondary
 *
 * urgency 在非 closing 角色返回 null，调用方应跳过该词。
 */
export function pickEmphasisWeight(
  kind: EmphasisKind,
  role: CardRole
): EmphasisWeight | null {
  switch (kind) {
    case "number":
    case "outcome":
    case "contrarian":
      return "primary";
    case "identity":
    case "pain":
      return "secondary";
    case "urgency":
      return role === "closing" ? "secondary" : null;
  }
}

// ─────────────────────── 风格强度 gate（SPEC §2.5.5 末段表）──────────────────────

export interface EmphasisLimits {
  /** 每张 primary 数量上下限 */
  primary: { min: number; max: number };
  /** 每张 secondary 数量上下限 */
  secondary: { min: number; max: number };
  /**
   * 字号差距等级（agent 在 prompt 里翻译成 typography 指令）：
   *  - 'extreme'：极大（爆款大字报感）
   *  - 'medium'：中等
   *  - 'small'：小（信息层级感）
   */
  fontSizeContrast: "extreme" | "medium" | "small";
}

/**
 * SPEC §2.5.5 风格强度 gate 表：
 *  | viralIntensity | primary | secondary | 字号差距 |
 *  | high           | 1-2     | 1-2       | 极大     |
 *  | medium         | 1       | 0-1       | 中等     |
 *  | low            | 0-1     | 0         | 小       |
 */
export function getEmphasisLimits(
  intensity: ViralIntensity
): EmphasisLimits {
  if (intensity === "high") {
    return {
      primary: { min: 1, max: 2 },
      secondary: { min: 1, max: 2 },
      fontSizeContrast: "extreme",
    };
  }
  if (intensity === "medium") {
    return {
      primary: { min: 1, max: 1 },
      secondary: { min: 0, max: 1 },
      fontSizeContrast: "medium",
    };
  }
  // low
  return {
    primary: { min: 0, max: 1 },
    secondary: { min: 0, max: 0 },
    fontSizeContrast: "small",
  };
}

// ─────────────────────── 校验工具（caller 在 outline 阶段防越界）──────────────────────

/**
 * 校验一组 emphasis_words 是否符合该 intensity 的 limits；
 * 返回 [合规子集, 被裁剪掉的项]。caller 可决定是直接用裁剪后的，还是报警让 LLM 重写。
 *
 * 裁剪策略：保序，先优先保留 primary，再保留 secondary，超过 max 的丢弃。
 */
export function clampEmphasisWords(
  words: EmphasisWord[],
  intensity: ViralIntensity
): { kept: EmphasisWord[]; dropped: EmphasisWord[] } {
  const limits = getEmphasisLimits(intensity);
  const kept: EmphasisWord[] = [];
  const dropped: EmphasisWord[] = [];

  let primaryCount = 0;
  let secondaryCount = 0;

  // 第一遍：先收 primary（保序）
  for (const w of words) {
    if (w.weight !== "primary") continue;
    if (primaryCount < limits.primary.max) {
      kept.push(w);
      primaryCount++;
    } else {
      dropped.push(w);
    }
  }
  // 第二遍：收 secondary
  for (const w of words) {
    if (w.weight !== "secondary") continue;
    if (secondaryCount < limits.secondary.max) {
      kept.push(w);
      secondaryCount++;
    } else {
      dropped.push(w);
    }
  }

  return { kept, dropped };
}
