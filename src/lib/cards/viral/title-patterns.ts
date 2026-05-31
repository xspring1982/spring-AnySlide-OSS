// SPEC §2.5.2 模块 2：爆款句式库（titlePatterns）+ §2.5.3 反爆款词黑名单
//
// 用于生成每张卡片的标题/副标题（不只是封面）。
// Claude 写 outline 时按下面的句式结构造句，由 §2.6 prompt 注入。

import type { ViralIntensity } from "./types";

export type TitlePatternId =
  | "number" // 数字结构
  | "contrast" // 反差结构
  | "benefit" // 利益承诺
  | "timely" // 时效紧迫
  | "identity" // 身份共鸣
  | "rhetorical"; // 反问钩子

export interface TitlePattern {
  id: TitlePatternId;
  zhName: string;
  structure: string; // 句式骨架
  whenToUse: string;
  example: string;
}

/** SPEC §2.5.2 表格 6 行，一字不差 */
export const TITLE_PATTERNS: TitlePattern[] = [
  {
    id: "number",
    zhName: "数字结构",
    structure: "{N} 个 / N 步 / N 招 / N 种 / N 大 + 主体",
    whenToUse: "干货、清单、教程",
    example: "5 个让你睡得更好的小习惯",
  },
  {
    id: "contrast",
    zhName: "反差结构",
    structure: "万万没想到 / 别再 X 了 / 其实 / 原来 + 反转",
    whenToUse: "颠覆、反常识",
    example: "万万没想到，喝水也有错误姿势",
  },
  {
    id: "benefit",
    zhName: "利益承诺",
    structure: "省 X% / 赚 X / 0 基础 / 一文搞懂 / 一次学会",
    whenToUse: "工具、教程",
    example: "0 基础也能学会的视频剪辑",
  },
  {
    id: "timely",
    zhName: "时效紧迫",
    structure: "2026 / 今年最新 / 最近 / 刚出的 / 限时",
    whenToUse: "新事物、热点",
    example: "2026 年最值得入坑的 5 个副业",
  },
  {
    id: "identity",
    zhName: "身份共鸣",
    structure: "打工人 / 宝妈 / 学生党 / 自媒体人 / 姐妹们",
    whenToUse: "圈层向",
    example: "宝妈也能轻松搞定的 30 分钟晚餐",
  },
  {
    id: "rhetorical",
    zhName: "反问钩子",
    structure: "你还在 ... 吗？ / 为什么 ...？ / 凭什么 ...？",
    whenToUse: "引发思考",
    example: "你还在用错误的方法学英语吗？",
  },
];

const PATTERNS_BY_ID: Record<TitlePatternId, TitlePattern> =
  TITLE_PATTERNS.reduce(
    (acc, p) => {
      acc[p.id] = p;
      return acc;
    },
    {} as Record<TitlePatternId, TitlePattern>
  );

export function getTitlePattern(id: TitlePatternId): TitlePattern {
  return PATTERNS_BY_ID[id];
}

// ─────────────────────── 句式叠加规则（SPEC §2.5.2 句式叠加规则）──────────────────────

/** 叠加强度：strong / medium / weak —— 直接对应 §2.5.2 三档示例 */
export type StackingStrength = "strong" | "medium" | "weak";

export interface StackingRule {
  strength: StackingStrength;
  /** 该强度下允许使用的句式 id 集合（rhetorical/timely 等会被 low/strong 限制） */
  allowedPatterns: TitlePatternId[];
  /** 至少叠加几种 */
  minPatterns: number;
  /** 最多叠加几种 */
  maxPatterns: number;
  /** SPEC 给出的示例叠加组合，提示用 */
  exampleStack: string;
}

/**
 * SPEC §2.5.2 句式叠加规则的 viralIntensity gate：
 *  - high：强叠加为主，至少 2 种结构组合（identity + number + benefit）
 *  - medium：中叠加为主（number + benefit）
 *  - low：弱单用，只允许"数字结构"和"反问钩子"（且反问要克制）
 */
export function getStackingRule(intensity: ViralIntensity): StackingRule {
  if (intensity === "high") {
    return {
      strength: "strong",
      allowedPatterns: TITLE_PATTERNS.map((p) => p.id),
      minPatterns: 2,
      maxPatterns: 3,
      exampleStack: "[身份共鸣] + [数字结构] + [利益承诺]",
    };
  }
  if (intensity === "medium") {
    return {
      strength: "medium",
      // medium 不强推时效紧迫与反问，允许其余 4 种
      allowedPatterns: ["number", "contrast", "benefit", "identity"],
      minPatterns: 2,
      maxPatterns: 2,
      exampleStack: "[数字结构] + [利益承诺]",
    };
  }
  // low：仅数字结构 + 反问钩子（且反问要克制）
  return {
    strength: "weak",
    allowedPatterns: ["number", "rhetorical"],
    minPatterns: 1,
    maxPatterns: 1,
    exampleStack: "[数字结构] 单用，例：关于自律的 3 件事",
  };
}

// ─────────────────────── §2.5.3 反爆款词黑名单（全风格禁用）──────────────────────

/**
 * SPEC §2.5.3 黑名单：曾经爆款、现已沦为 AI 味/水文标志的词，所有风格禁用。
 * 设计为可扩展数组（不写成 union 类型），后续补词不用改类型签名。
 */
export const BANNED_PHRASES: string[] = [
  "震惊！",
  "速看！",
  "必看！",
  "天啊！",
  "炸裂！",
  "史上最强",
  "最全",
  "保姆级",
  "亲测有效",
  "真香",
  "绝绝子",
  "yyds",
  "破防了",
  "狠狠收藏",
];

/**
 * 检查字符串是否含黑名单短语；
 * 命中时返回首个命中的短语（caller 可用于错误提示），否则返回 null。
 *
 * 注意：黑名单的 "！" 是中文全角；为避免 caller 用半角导致误判，
 * 这里同时去除标点与空白后做包含匹配（保留中文字符）。
 */
export function findBannedPhrase(text: string): string | null {
  if (!text) return null;
  const normalized = normalize(text);
  for (const phrase of BANNED_PHRASES) {
    if (normalized.includes(normalize(phrase))) return phrase;
  }
  return null;
}

export function containsBannedPhrase(text: string): boolean {
  return findBannedPhrase(text) !== null;
}

function normalize(s: string): string {
  // 去全/半角标点 + 空白；保留中英文字母数字
  return s.replace(/[\s!?！？.,。、，:：;；"'""''`~()（）\[\]【】<>《》]/g, "");
}
