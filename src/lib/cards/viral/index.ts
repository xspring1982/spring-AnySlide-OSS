// SPEC §2.5 爆款基因 4 模块 —— 统一入口
//
// 4 模块由 §2.6 三 prompt 模板调度，agent 不直接暴露给用户。
// 各模块各自独立、各有 viralIntensity gate，本入口只做 re-export。

export type { CardRole, ViralIntensity } from "./types";

// §2.5.1 封面钩子
export {
  COVER_HOOKS,
  getCoverHook,
  getAvailableCoverHooks,
  pickCoverHook,
} from "./cover-hooks";
export type { CoverHook, CoverHookId, ContentSignal } from "./cover-hooks";

// §2.5.2 爆款句式 + §2.5.3 反爆款词黑名单
export {
  TITLE_PATTERNS,
  getTitlePattern,
  getStackingRule,
  BANNED_PHRASES,
  containsBannedPhrase,
  findBannedPhrase,
} from "./title-patterns";
export type {
  TitlePattern,
  TitlePatternId,
  StackingRule,
  StackingStrength,
} from "./title-patterns";

// §2.5.4 正文转化触发器
export {
  CONTENT_TRIGGERS,
  getContentTrigger,
  getAvailableTriggers,
  getTriggerCountForRole,
  pickContentTrigger,
} from "./content-triggers";
export type { ContentTrigger, TriggerKind } from "./content-triggers";

// §2.5.5 emphasis_words 强调分级
export {
  pickEmphasisWeight,
  getEmphasisLimits,
  clampEmphasisWords,
} from "./emphasis-words";
export type {
  EmphasisKind,
  EmphasisWeight,
  EmphasisWord,
  EmphasisLimits,
} from "./emphasis-words";
