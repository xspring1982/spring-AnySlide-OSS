// SPEC §2.4.1 — Cards 风格 schema TypeScript 接口
//
// 这是 §2.6 三 prompt 模板（analyze / outline-refine / prompt-assembly）
// 的硬依赖。本文件只定义类型；6 个风格的具体实例分别落到同目录下
// `xiaohongshu_fresh.ts` / `minimal_whitespace.ts` / ...，
// 通过 `index.ts` 注册表统一导出。
//
// 与 src/lib/styles/cards.ts 的关系：
//   - src/lib/styles/cards.ts —— 仅 picker UI 用的视觉元数据
//     （emoji / swatch / oneLineDesc）；
//   - 本文件 + 同目录 6 个风格文件 —— SPEC §2.4.1 完整 schema
//     （promptBase / preferredCompositions / fonts / ...），供 agent 拼装 prompt。
//   - 两边 id 必须一一对应（CardStyleId）。

import type { CompositionId } from "@/lib/cards/compositions";

/** SPEC §2.4.1 — 爆款基因强度。三模块共用类型，由本文件统一导出。 */
export type ViralIntensity = "high" | "medium" | "low";

/** SPEC §2.4.1 — emoji 投放策略 */
export type EmojiPolicy = "none" | "sparse" | "rich";

/** SPEC §2.4.1 — 封面构图 id 子集（来自 §2.3.1 的 4 个） */
export type CoverCompositionId =
  | "centered_quote_seal"
  | "hero_title"
  | "bold_headline"
  | "magazine_cover";

/**
 * SPEC §2.4.1 — 比例 id（6 个）。
 * 注意：cards 默认只用 ['3:4','4:5','1:1','9:16']，
 * '3:2' 和 '16:9' 主要给 slides，但 schema 字段保持 SPEC 全集，
 * 让 prompt-assembly 的 RATIO_PROMPT 在跨模块复用时类型对齐。
 */
export type RatioId = "3:4" | "4:5" | "1:1" | "9:16" | "3:2" | "16:9" | "4:3";

/** SPEC §2.4.1 — 5 段视觉约束块 */
export interface PromptBase {
  /** 风格形容词堆 */
  styleAdjectives: string;
  /** 色板（hex 或语义化） */
  colorPalette: string;
  /** 构图通用约束（光线 / 留白 / 视角） */
  composition: string;
  /** 质感线索（哑光纸 / 屏幕光 / 笔触） */
  texture: string;
  /** 反向 cues（"no AI slop, no purple gradients..."） */
  negativeCues: string;
}

/** SPEC §2.4.1 — 字体配置（CJK 子集化） */
export interface StyleFonts {
  heading: string;
  body: string;
  /** 装饰字体（如毛笔 / 手写），可选 */
  decorative?: string;
}

/** SPEC §2.4.1 — 6 个 cards 风格 id（与 src/lib/styles/cards.ts 对齐） */
export type CardStyleId =
  | "xiaohongshu_fresh"
  | "minimal_whitespace"
  | "japanese_healing"
  | "vintage_magazine"
  | "thick_paint_illustration"
  | "ink_chinese";

/** SPEC §2.4.1 — Cards 风格完整 schema */
export interface CardStyle {
  /** 例如 'xiaohongshu_fresh' */
  id: CardStyleId;
  /** 中文显示名 */
  name: string;

  // — 爆款基因强度（决定 emoji / 钩子 / 大字报浓度）
  viralIntensity: ViralIntensity;
  emojiPolicy: EmojiPolicy;

  // — 构图偏好
  /** top 5-8 picks（agent 优先选） */
  preferredCompositions: CompositionId[];
  /** 1-2 个推荐封面构图 */
  preferredCovers: CoverCompositionId[];
  /** 反模式（agent 避免选） */
  avoidCompositions: CompositionId[];

  // — 比例偏好
  /** top 2-3 picks */
  preferredRatios: RatioId[];
  /** 该风格默认比例 */
  defaultRatio: RatioId;

  // — 视觉约束（注入 prompt 的核心字段，5 段结构）
  promptBase: PromptBase;

  // — 字体
  fonts: StyleFonts;

  /** 实施状态：complete = 已通过 4 张实测；stub = 待 P0-3 填充 promptBase */
  status: "complete" | "stub";
}
