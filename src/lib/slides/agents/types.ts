// SPEC §3.5.1 / §3.5.2 — Slides Agent 输入输出类型

import type { SlideStyle } from "../styles/types";
import type { L1LayoutId } from "../layouts/types";
import type { L2PatternId } from "../visual-patterns/types";
import type { Locale } from "@/i18n/routing";

export type GenerationPath = "L1" | "L2";

export type SlideRatio = "16:9" | "9:16" | "4:3" | "1:1" | "3:2";

export type NarrativeArc =
  | "problem_solution"
  | "past_present_future"
  | "what_why_how"
  | "five_stages"
  | "compare_contrast"
  | "case_study"
  | "free_form";

/** SPEC §3.5.1 单张 slide 条目 */
export interface SlideEntry {
  /** 全局 1-based */
  index: number;
  role: "cover" | "agenda" | "section_divider" | "content" | "closing";
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  callout?: string;
  visual_hint?: string;
  speaker_notes?: string;
  /** L1 路径用 */
  layout_id?: L1LayoutId;
  /** L2 路径用 */
  visual_pattern?: L2PatternId;
  /** L1 模板填充路径用:引用模板 template_outline 的第几个 section(1-based)*/
  template_section_index?: number;
}

/** SPEC §3.5.1 输入 */
export interface SlidesAnalyzeInput {
  userContent: string;
  userIntent?: string;
  /** 已选风格(含 supports / compatibleLayouts / l2PromptBase) */
  style: SlideStyle;
  /** 用户选的路径(决定输出 layout_id 还是 visual_pattern) */
  generationPath: GenerationPath;
  ratio: SlideRatio;
  targetCount?: number;
  /** AI 推荐风格 / 比例(类比 cards M2.7) */
  autoStyle?: boolean;
  autoRatio?: boolean;
  /** M9 多语言:任务的目标语言,影响 LLM 输出语言 */
  locale?: Locale;
  template?: {
    preset_audience: string;
    preset_use_case: string;
    preset_outline_strategy: string;
    custom_prompt_addon?: string;
  };
  clarifyAnswers?: {
    audience?: string;
    use_case?: string;
    outline_strategy?: string;
    speaker_notes_required?: boolean;
    flexible_count?: boolean;
  };
  researchContext?: string;
}

/** SPEC §3.5.1 输出(层级结构) */
export interface SlidesAnalyzeOutput {
  topic: string;
  task_title: string;
  audience_signal: string;
  use_case: string;
  /** M9:LLM 输出大纲所用语言,与 SlidesAnalyzeInput.locale 对齐(routing 5 选 1) */
  language: Locale;
  narrative_arc: NarrativeArc;
  recommended_count: number;
  speaker_notes_required: boolean;

  outline: {
    cover: SlideEntry;
    agenda?: SlideEntry;
    sections: Array<{
      divider?: SlideEntry;
      slides: SlideEntry[];
    }>;
    closing: SlideEntry;
  };

  /** AI 推荐(autoStyle/autoRatio 时由 LLM 写) */
  recommended_style?: string;
  recommended_style_reason?: string;
  recommended_ratio?: string;
}

export type SlidesAnalyzeParseError =
  | { kind: "non_json"; raw: string; cause: unknown }
  | { kind: "missing_field"; path: string }
  | { kind: "bad_path_field"; expected: GenerationPath; got: string };

/** SPEC §3.5.2 refine 5 模式 */
export type SlidesRefineMode =
  | "regenerate_slide"
  | "change_layout"
  | "restructure_arc"
  | "add_slide"
  | "delete_slide";

export interface SlidesRefineInput {
  currentOutline: SlidesAnalyzeOutput;
  style: SlideStyle;
  generationPath: GenerationPath;
  mode: SlidesRefineMode;
  targetIndex?: number;
  newLayoutId?: L1LayoutId;
  newVisualPattern?: L2PatternId;
  newNarrativeArc?: NarrativeArc;
  insertAfter?: number;
  userInstruction?: string;
}
