// SPEC §2.6 — Cards Agent 三 Prompt 模板：统一入口
//
//   §2.6.1 analyze.ts          — 用户内容 → outline JSON
//   §2.6.2 outline-refine.ts   — outline 局部更新（与 analyze 共享 system prefix）
//   §2.6.3 prompt-assembly.ts  — outline 单卡 → gpt-image-2 prompt（5 段拼装，纯字符串）
//
// AI Adapter（src/lib/ai/）尚未落地；本目录文件全部为纯函数（zero side effect），
// 调用方在 §5.3 PR 中接入 Claude / gpt-image-2 即可。

// §2.6.1 analyze.ts
export {
  buildAnalyzeSystemPrompt,
  buildAnalyzeUserPrompt,
  buildAnalyzeMessages,
  parseAnalyzeOutput,
  ANALYZE_CALL_CONFIG,
} from "./analyze";
export type {
  AnalyzeInput,
  AnalyzeCard,
  AnalyzeOutput,
  AnalyzeParseError,
} from "./analyze";

// §2.6.2 outline-refine.ts
export {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  buildRefineMessages,
  parseRefineOutput,
  REFINE_CALL_CONFIG,
} from "./outline-refine";
export type {
  RefineMode,
  RefineInput,
  RefineCardOutput,
  RefineRestructureOutput,
  RefineOutput,
  RefineParseError,
} from "./outline-refine";

// §2.6.3 prompt-assembly.ts
export {
  assembleCardPrompt,
  RATIO_PROMPT,
  COVER_HOOK_PROMPTS,
} from "./prompt-assembly";
export type { AssemblyInput } from "./prompt-assembly";
