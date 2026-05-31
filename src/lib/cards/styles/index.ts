// SPEC §2.4.5 — Cards 风格库注册表
//
// 6 个风格（1 complete + 5 stub），统一导出 + 查询函数。
// 与 src/lib/styles/cards.ts 的 picker meta 通过 CardStyleId 一一对应。

import type { CardStyle, CardStyleId } from "./types";
import { xiaohongshu_fresh } from "./xiaohongshu_fresh";
import { minimal_whitespace } from "./minimal_whitespace";
import { japanese_healing } from "./japanese_healing";
import { vintage_magazine } from "./vintage_magazine";
import { thick_paint_illustration } from "./thick_paint_illustration";
import { ink_chinese } from "./ink_chinese";

/** SPEC §2.4 — 6 个 cards 风格完整 schema */
export const CARD_STYLES: Record<CardStyleId, CardStyle> = {
  xiaohongshu_fresh,
  minimal_whitespace,
  japanese_healing,
  vintage_magazine,
  thick_paint_illustration,
  ink_chinese,
};

/** 默认风格（与 src/lib/styles/cards.ts DEFAULT_CARD_STYLE 对齐） */
export const DEFAULT_CARD_STYLE_ID: CardStyleId = "xiaohongshu_fresh";

/** 严格按 id 取风格；id 不在枚举中抛错（agent 调用方应已校验过） */
export function getCardStyle(id: CardStyleId): CardStyle {
  const style = CARD_STYLES[id];
  if (!style) {
    throw new Error(`Unknown card style: ${id}`);
  }
  return style;
}

/** 容错版：未知 id 返回 undefined（UI 层用） */
export function findCardStyle(id: string): CardStyle | undefined {
  return (CARD_STYLES as Record<string, CardStyle>)[id];
}

export type {
  CardStyle,
  CardStyleId,
  ViralIntensity,
  EmojiPolicy,
  CoverCompositionId,
  RatioId,
  PromptBase,
  StyleFonts,
} from "./types";
