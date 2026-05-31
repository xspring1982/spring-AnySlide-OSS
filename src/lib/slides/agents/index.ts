// SPEC §3.5 — Slides Agent 三 prompt 模板:统一入口

// §3.5.1 analyze
export {
  buildSlidesAnalyzeSystemPrompt,
  buildSlidesAnalyzeUserPrompt,
  buildSlidesAnalyzeMessages,
  parseSlidesAnalyzeOutput,
  extractTargetPageCount,
  SLIDES_ANALYZE_CALL_CONFIG,
} from "./analyze";

// §3.5.2 outline-refine
export {
  buildSlidesRefineSystemPrompt,
  buildSlidesRefineUserPrompt,
  buildSlidesRefineMessages,
  parseSlidesRefineOutput,
  SLIDES_REFINE_CALL_CONFIG,
} from "./outline-refine";

// §3.5.3 prompt-assembly
export { assembleSlidePrompt } from "./prompt-assembly";
export type { SlidesAssemblyInput, SlidesAssemblyOutput } from "./prompt-assembly";

// types
export type {
  GenerationPath,
  SlideRatio,
  NarrativeArc,
  SlideEntry,
  SlidesAnalyzeInput,
  SlidesAnalyzeOutput,
  SlidesAnalyzeParseError,
  SlidesRefineInput,
  SlidesRefineMode,
} from "./types";
