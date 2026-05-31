// SPEC §2.5.4 模块 3：正文转化触发器（content_triggers）
//
// 注入到正文 key_text（不是标题），目的是触发用户的收藏 / 转发 / 互动 / 行动。
// 每张卡片最多 1-2 个，避免堆砌；不作为独立视觉元素（SPEC §2.5.4 末段强调）。

import type { CardRole, ViralIntensity } from "./types";

export type TriggerKind =
  | "save" // 收藏
  | "share" // 转发
  | "interact" // 互动
  | "action"; // 行动

export interface ContentTrigger {
  kind: TriggerKind;
  zhName: string;
  /** 句式池，agent 从中挑一个写进 key_text */
  phrases: string[];
  /** SPEC 推荐的何时使用（说明用） */
  whenToUse: string;
}

/** SPEC §2.5.4 表格 4 行，句式池一字不差 */
export const CONTENT_TRIGGERS: ContentTrigger[] = [
  {
    kind: "save",
    zhName: "收藏触发",
    phrases: [
      "建议收藏",
      "划重点",
      "重要",
      "收藏起来慢慢看",
      "打码记笔记",
    ],
    whenToUse: "干货密度高的卡片",
  },
  {
    kind: "share",
    zhName: "转发触发",
    phrases: ["@闺蜜", "转给同事", "分享给好友", "让 TA 也看看"],
    whenToUse: "实用工具型",
  },
  {
    kind: "interact",
    zhName: "互动触发",
    phrases: [
      "你怎么看？",
      "你属于哪种？",
      "评论区聊聊",
      "你是哪一种？",
    ],
    whenToUse: "观点型、分类型",
  },
  {
    kind: "action",
    zhName: "行动触发",
    phrases: ["立刻去做", "今天就开始", "现在打开 X", "别再拖了"],
    whenToUse: "收尾卡片（closing）",
  },
];

const TRIGGERS_BY_KIND: Record<TriggerKind, ContentTrigger> =
  CONTENT_TRIGGERS.reduce(
    (acc, t) => {
      acc[t.kind] = t;
      return acc;
    },
    {} as Record<TriggerKind, ContentTrigger>
  );

export function getContentTrigger(kind: TriggerKind): ContentTrigger {
  return TRIGGERS_BY_KIND[kind];
}

// ─────────────────────── 风格强度 gate（SPEC §2.5.4 风格强度 gate 表）──────────────────────

/**
 * SPEC §2.5.4：
 *  - high：全 4 类可用，每张 0-1 个
 *  - medium：仅「收藏」/「互动」，不强推转发
 *  - low：完全禁用，靠内容质量自然让用户保存
 */
export function getAvailableTriggers(
  intensity: ViralIntensity
): TriggerKind[] {
  if (intensity === "high") return ["save", "share", "interact", "action"];
  if (intensity === "medium") return ["save", "interact"];
  return []; // low：完全禁用
}

// ─────────────────────── 触发器分布规则（SPEC §2.5.4 触发器分布规则）──────────────────────

/**
 * 单张卡片应有几个触发器：
 *  - cover：0（钩子已在标题里）
 *  - content：每 3 张允许 1 个，类型轮换；优先「收藏」/「互动」
 *  - closing：必带 1 个；优先「行动」/「转发」
 *
 * caller 调用时传 contentIndex（在 content 卡片中的 0-based 序号），
 * 仅当 contentIndex % 3 === 0 时返回 1 个；其余返回 0。
 */
export function getTriggerCountForRole(input: {
  role: CardRole;
  /** 仅 content 角色用得到，0-based */
  contentIndex?: number;
}): 0 | 1 {
  const { role, contentIndex = 0 } = input;
  if (role === "cover") return 0;
  if (role === "closing") return 1;
  // content
  return contentIndex % 3 === 0 ? 1 : 0;
}

/**
 * 给指定角色挑触发器类型。
 * 同时受 viralIntensity gate 过滤；若 intensity = low 则永远返回 null（禁用）。
 *
 * - cover：恒返回 null
 * - content：在 [save, interact] 中按 contentIndex 轮换（满足"类型轮换"规则）
 * - closing：优先 action，其次 share
 */
export function pickContentTrigger(input: {
  role: CardRole;
  intensity: ViralIntensity;
  /** 仅 content 角色用得到，0-based 触发器序号（不是卡片序号） */
  triggerSeq?: number;
}): TriggerKind | null {
  const { role, intensity, triggerSeq = 0 } = input;
  if (role === "cover") return null;

  const allowed = new Set(getAvailableTriggers(intensity));
  if (allowed.size === 0) return null;

  if (role === "closing") {
    if (allowed.has("action")) return "action";
    if (allowed.has("share")) return "share";
    if (allowed.has("interact")) return "interact";
    if (allowed.has("save")) return "save";
    return null;
  }

  // role === 'content'：在「收藏」「互动」之间轮换（SPEC：优先用 save / interact）
  const rotation: TriggerKind[] = ["save", "interact"];
  for (let i = 0; i < rotation.length; i++) {
    const idx = (triggerSeq + i) % rotation.length;
    const cand = rotation[idx];
    if (allowed.has(cand)) return cand;
  }
  // intensity=high 仍可能落到 share（轮换到极端边界）
  if (allowed.has("share")) return "share";
  return null;
}
