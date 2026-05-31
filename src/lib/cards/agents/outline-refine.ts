// SPEC §2.6.2 — outline-refine.ts prompt
//
// 用户在 §2.1 Step 7（介入点 2）对大纲提调整意见时，**局部更新** outline，
// 避免全部重生导致整体风格漂移。
//
// 三种 mode：
//   - regenerate_all  → caller 直接重跑 §2.6.1 analyze.ts（不调本文件）
//   - regenerate_card → 仅返回第 N 张更新版（本文件处理）
//   - restructure     → 返回新的完整 outline + preserved_indices（本文件处理）
//
// 与 analyze.ts 共享 system prefix（命中 prompt cache，详 SPEC §5.3.2）。
//
// 本文件只交付 prompt 构造 + 输出类型 + 解析校验；
// 真正的 Claude 调用由 §5.3 AI Adapter 落地后接入。

import { buildAnalyzeSystemPrompt } from "./analyze";
import type {
  AnalyzeCard,
  AnalyzeOutput,
} from "./analyze";
import type {
  CardStyle,
  RatioId,
} from "@/lib/cards/styles/types";

// ─────────────────────── 类型 ───────────────────────

export type RefineMode = "regenerate_card" | "restructure";

export interface RefineInput {
  /** 当前的完整大纲 */
  currentOutline: AnalyzeOutput;
  refineMode: RefineMode;
  /** 用户的自然语原话（如"把第 3 张换成 5 个观点"） */
  userInstruction: string;
  /** refineMode=regenerate_card 时必填，1-based card index */
  targetCardIndex?: number;
  /** 同 analyze.ts，注入风格 gate */
  style: CardStyle;
  ratio: RatioId;
}

export interface RefineCardOutput {
  mode: "regenerate_card";
  /** 单张更新后的卡片 */
  card: AnalyzeCard;
}

export interface RefineRestructureOutput {
  mode: "restructure";
  /** 整套新大纲 */
  outline: AnalyzeOutput;
  /** 哪几张沿用原版（不重生图） */
  preserved_indices: number[];
}

export type RefineOutput = RefineCardOutput | RefineRestructureOutput;

export type RefineParseError =
  | { kind: "non_json"; raw: string; cause: unknown }
  | { kind: "missing_field"; path: string }
  | { kind: "mode_mismatch"; expected: RefineMode; got: string }
  | { kind: "card_index_mismatch"; expected: number; got: number }
  | {
      kind: "preserved_includes_target";
      targetIndex: number;
      preserved: number[];
    };

// ─────────────────────── prompt 拼装 ───────────────────────

/**
 * SPEC §2.6.2：与 analyze.ts 共享 system prefix（命中 prompt cache）。
 * 调用方应在 §5.3 AI Adapter 中保证 cache_control: 'ephemeral' 复用。
 */
export function buildRefineSystemPrompt(style: CardStyle): string {
  return buildAnalyzeSystemPrompt(style);
}

/** SPEC §2.6.2 Prompt 模板（user 部分） */
export function buildRefineUserPrompt(input: RefineInput): string {
  const {
    currentOutline,
    refineMode,
    userInstruction,
    targetCardIndex,
    style,
    ratio,
  } = input;

  const lines: string[] = [
    "# 当前任务上下文",
    "",
    `风格 ID：${style.id}`,
    `比例：${ratio}`,
    "",
    "当前大纲（请基于此调整，不要全部推翻）：",
    "<currentOutline>",
    JSON.stringify(currentOutline, null, 2),
    "</currentOutline>",
    "",
    "# 模式说明",
    "",
    `mode = "${refineMode}"`,
    "",
  ];

  if (refineMode === "regenerate_card") {
    if (typeof targetCardIndex !== "number") {
      throw new Error(
        "[buildRefineUserPrompt] regenerate_card 模式必须传 targetCardIndex",
      );
    }
    const target = currentOutline.cards.find((c) => c.index === targetCardIndex);
    if (!target) {
      throw new Error(
        `[buildRefineUserPrompt] targetCardIndex=${targetCardIndex} 在 currentOutline.cards 中找不到`,
      );
    }
    lines.push(
      "## 如果 mode = regenerate_card",
      `你只需返回一张卡片（targetCardIndex=${targetCardIndex}）。`,
      "其他卡片保持不变。",
      "新卡片的 composition 应**避开**原版的，提供视觉变化。",
      "emphasis_words 重选，但符合 §2.5.5 规则。",
      "",
      '返回 JSON：{ "mode": "regenerate_card", "card": {...} }',
      "",
      "# 目标卡片",
      `targetCardIndex: ${targetCardIndex}`,
      `原卡片：${JSON.stringify(target)}`,
    );
  } else {
    lines.push(
      "## 如果 mode = restructure",
      "返回完整新大纲。",
      "**尽可能保留**原大纲里**未被用户提及**的卡片（preserved_indices 字段标识）。",
      "被保留的卡片 → 复用原 index 和 composition（不要换构图，避免重生图）。",
      "新增 / 修改的卡片 → 用新 index（如插入第 4 张则后续顺延）。",
      "",
      '返回 JSON：{ "mode": "restructure", "outline": {...}, "preserved_indices": [1, 2, 5] }',
    );
  }

  lines.push(
    "",
    "# 必须遵守",
    "",
    "- 输出严格 JSON，无 markdown 围栏",
    `- 中文，emoji 遵守 emojiPolicy=${style.emojiPolicy}`,
    "- 总张数限 5-12",
    "- preserved_indices 中标识的卡片，对应 cards[i] 必须 deep-equal 原版",
    "- 不要改第 1 张 cover 的 cover_hook，除非用户明确要求",
    "",
    "# 用户反馈",
    `<userInstruction>${userInstruction}</userInstruction>`,
    "",
    "按规则输出 JSON。",
  );

  return lines.join("\n");
}

export function buildRefineMessages(input: RefineInput): {
  system: string;
  user: string;
} {
  return {
    system: buildRefineSystemPrompt(input.style),
    user: buildRefineUserPrompt(input),
  };
}

// ─────────────────────── 解析与校验 ───────────────────────

export function parseRefineOutput(
  raw: string,
  ctx: { mode: RefineMode; targetCardIndex?: number },
):
  | { ok: true; output: RefineOutput }
  | { ok: false; error: RefineParseError } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch (e) {
    return { ok: false, error: { kind: "non_json", raw, cause: e } };
  }
  if (!isObject(parsed)) {
    return { ok: false, error: { kind: "missing_field", path: "$" } };
  }

  const mode = (parsed as { mode?: unknown }).mode;
  if (mode !== ctx.mode) {
    return {
      ok: false,
      error: {
        kind: "mode_mismatch",
        expected: ctx.mode,
        got: String(mode),
      },
    };
  }

  if (ctx.mode === "regenerate_card") {
    if (!("card" in parsed)) {
      return { ok: false, error: { kind: "missing_field", path: "card" } };
    }
    const card = (parsed as { card: AnalyzeCard }).card;
    if (
      typeof ctx.targetCardIndex === "number" &&
      card?.index !== ctx.targetCardIndex
    ) {
      return {
        ok: false,
        error: {
          kind: "card_index_mismatch",
          expected: ctx.targetCardIndex,
          got: Number(card?.index),
        },
      };
    }
    return {
      ok: true,
      output: { mode: "regenerate_card", card },
    };
  }

  // restructure
  for (const key of ["outline", "preserved_indices"] as const) {
    if (!(key in parsed)) {
      return { ok: false, error: { kind: "missing_field", path: key } };
    }
  }
  const preserved = (parsed as { preserved_indices: unknown }).preserved_indices;
  if (!Array.isArray(preserved) || preserved.some((n) => typeof n !== "number")) {
    return {
      ok: false,
      error: { kind: "missing_field", path: "preserved_indices" },
    };
  }

  return {
    ok: true,
    output: {
      mode: "restructure",
      outline: (parsed as { outline: AnalyzeOutput }).outline,
      preserved_indices: preserved as number[],
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─────────────────────── 调用配置（占位） ───────────────────────

/**
 * SPEC §2.6.2 调用配置：
 *
 *   const response = await ai.claude.complete({
 *     system: buildRefineSystemPrompt(style),    // 与 analyze.ts 同 prefix → 命中 cache
 *     user: buildRefineUserPrompt(input),
 *     model: 'mid',
 *     maxTokens: 2048,                            // 比 analyze 小，因为只更新部分
 *     temperature: 0.6,                           // 略低，更稳定
 *     cache: true,
 *   });
 *   const parsed = parseRefineOutput(response.text, {
 *     mode: input.refineMode,
 *     targetCardIndex: input.targetCardIndex,
 *   });
 */
export const REFINE_CALL_CONFIG = {
  model: { default: "claude-sonnet-4-6", high: "claude-opus-4-7" } as const,
  maxTokens: 2048,
  temperature: 0.6,
  cacheSystem: true,
} as const;
