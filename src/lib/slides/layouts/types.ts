// SPEC §3.4.2.1 — L1 Layout schema(HTML 可编辑路径用)

export type L1LayoutId =
  | "hero-cover"
  | "act-divider"
  | "big-numbers-grid"
  | "quote-image"
  | "image-grid"
  | "pipeline"
  | "hero-question"
  | "big-quote"
  | "before-after"
  | "lead-image-side-text";

export type L1Category =
  | "cover"
  | "divider"
  | "data"
  | "narrative"
  | "media"
  | "flow"
  | "reference"
  | "comparison";

/** 内容字段约束 */
export interface L1ContentSlots {
  kicker?: { maxChars: number };
  title?: { maxChars: number; level: "h-hero" | "h-xl" | "h-md" };
  subtitle?: { maxChars: number };
  lead?: { maxChars: number };
  body?: { maxChars: number; maxParagraphs: number };
  bullets?: { maxItems: number; maxCharsPerItem: number };
  callout?: { maxChars: number };
  images?: { count: number; aspectRatio: "4:3" | "16:10" | "1:1" | "3:4" };
  statCards?: { count: number; numberMaxChars: number; noteMaxChars: number };
  steps?: { count: number; titleMaxChars: number; descMaxChars: number };
  quote?: { maxChars: number; attributionMaxChars: number };
  attribution?: { maxChars: number };
  meta?: { maxChars: number };
}

export interface L1Layout {
  id: L1LayoutId;
  name: string;
  category: L1Category;

  visualDesc: string;
  scenario: string;

  /** CSS grid class 标识(对应 guizang grid 类) */
  gridClass: string;
  /** 主插槽数量(数据卡数 / 图片数 / step 数) */
  slotCount: number;

  contentSlots: L1ContentSlots;

  /** 风格 CSS 实施时必须满足的要点 */
  themeCssRequirements: string[];

  /** agent 选择信号(关键词触发) */
  selectionKeywords: string[];
}
