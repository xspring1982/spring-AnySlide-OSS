// SPEC §3.4.3.2 — L2 visual_pattern schema(AI 全屏图片路径用)

export type L2PatternId =
  // 基础布局 10 个
  | "title-hero"
  | "quote-callout"
  | "key-stat"
  | "split-screen"
  | "icon-grid"
  | "two-columns"
  | "three-columns"
  | "image-caption"
  | "agenda"
  | "bullet-list"
  // 信息图衍生 14 个
  | "linear-progression"
  | "binary-comparison"
  | "comparison-matrix"
  | "hierarchical-layers"
  | "hub-spoke"
  | "bento-grid"
  | "funnel"
  | "dashboard"
  | "venn-diagram"
  | "circular-flow"
  | "winding-roadmap"
  | "tree-branching"
  | "iceberg"
  | "bridge";

export type L2PatternCategory = "basic" | "infographic";

/** gpt-image-2 在该 pattern 下的渲染稳定性(实测) */
export type L2Reliability = "high" | "medium" | "low";

export interface L2VisualPattern {
  id: L2PatternId;
  name: string;
  category: L2PatternCategory;

  /** 注入 prompt 的视觉描述(英文,baoyu 原文) */
  visualHint: string;
  /** 一句话适用场景 */
  scenario: string;
  /** 一句话内容字段约束 */
  contentFields: string;

  reliability: L2Reliability;

  /** agent 选择信号 */
  selectionKeywords: string[];
}
