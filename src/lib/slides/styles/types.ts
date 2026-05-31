// SPEC §3.3.1 — Slides 风格 schema
//
// 6 风格(modern_pro 完整 + 5 stub),与 src/lib/styles/slides.ts(picker meta)对齐。

import type { L1LayoutId } from "../layouts/types";
import type { RatioId } from "@/lib/cards/styles/types";

export type SlideStyleId =
  | "modern_pro"
  | "elegant_dark"
  | "academic_serif"
  | "ink_classic"
  | "pink_girl"
  | "swiss_grid";

export type SupportedPath = "L1" | "L2";

export type SlideEmojiPolicy = "none" | "sparse" | "rich";

export type BackgroundType =
  | "solid"
  | "gradient"
  | "webgl_fluid"
  | "paper_texture"
  | "grid_lines"
  | "none";

/** SPEC §3.3.1 风格 schema */
export interface SlideStyle {
  id: SlideStyleId;
  name: string;
  emoji: string;
  oneLineDesc: string;

  supports: SupportedPath[];

  colors: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    text: string;
    textSecondary: string;
  };

  fonts: {
    heading: string;
    body: string;
    code?: string;
    decorative?: string;
  };

  scale: {
    h1: number;
    h2: number;
    h3: number;
    body: number;
    caption: number;
  };

  /** 第一阶段 6 风格全部 = 10 个 universal layouts */
  compatibleLayouts: L1LayoutId[];

  defaultBackground: {
    type: BackgroundType;
    config?: Record<string, unknown>;
  };

  emojiPolicy: SlideEmojiPolicy;

  /** L2 专用 5 段视觉描述;纯 L1 风格为 undefined */
  l2PromptBase?: {
    styleAdjectives: string;
    colorPalette: string;
    composition: string;
    texture: string;
    negativeCues: string;
  };

  /** 默认比例 — slides 默认 16:9 */
  defaultRatio: RatioId;

  status: "complete" | "stub";
}
