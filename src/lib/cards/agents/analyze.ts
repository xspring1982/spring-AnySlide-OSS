// SPEC §2.6.1 — analyze.ts 完整 prompt
//
// 用途：用户原始内容 → 一次性输出完整 outline JSON（含每张卡片的
// composition / emphasis_words / cover_hook / content_trigger）。
//
// 本文件只交付 **prompt 构造 + 输出类型 + 解析校验**，
// 真正的 Claude 调用由 §5.3 AI Adapter 落地后接入（见文末 callAnalyze stub 注释）。

import {
  ALL_COMPOSITIONS,
  CLOSING_COMPOSITIONS,
  COVER_COMPOSITIONS,
  CONTENT_COMPOSITIONS,
  type CompositionId,
} from "@/lib/cards/compositions";
import {
  BANNED_PHRASES,
  COVER_HOOKS,
  CONTENT_TRIGGERS,
  TITLE_PATTERNS,
  getAvailableCoverHooks,
  getAvailableTriggers,
  getEmphasisLimits,
  getStackingRule,
} from "@/lib/cards/viral";
import type {
  CoverHookId,
  TriggerKind,
  EmphasisKind,
  EmphasisWeight,
} from "@/lib/cards/viral";
import type {
  CardStyle,
  RatioId,
} from "@/lib/cards/styles/types";

// ─────────────────────── 类型 ───────────────────────

/** SPEC §2.6.1 输入 */
export interface AnalyzeInput {
  /** 用户粘贴的原始文本（textarea + PDF 解析结果合并） */
  userContent: string;
  /** 用户附加的简短意图（可选） */
  userIntent?: string;
  /**
   * 已选风格(含 viralIntensity / preferredCompositions / emojiPolicy)
   * 当 autoStyle=true 时,这个 style 仅作占位让 system prompt 能注入构图库,
   * 真正的"应该用哪个风格"由 LLM 推荐到 outline.recommended_style。
   */
  style: CardStyle;
  /** 比例;当 autoRatio=true 时同上,LLM 推荐到 outline.recommended_ratio */
  ratio: RatioId;
  /** M2.7:用户选了 "AI 推荐" → 让 LLM 在 6 风格中基于内容主题推荐 */
  autoStyle?: boolean;
  /** M2.7:用户选了 "AI 推荐" 比例 → 让 LLM 推荐 */
  autoRatio?: boolean;
  /** 用户期望张数（可选，未填则 agent 推荐） */
  targetCount?: number;
  /** 模板预填（可选） */
  template?: {
    preset_audience: string;
    preset_focus: string;
    preset_tone: string;
    custom_prompt_addon?: string;
  };
  /** Jina Reader 抓的补充材料（如有） */
  researchContext?: string;
}

/** SPEC §2.6.1 卡片 outline */
export interface AnalyzeCard {
  /** 1-based */
  index: number;
  role: "cover" | "content" | "closing";
  /** ≤15 字 */
  title: string;
  /** ≤25 字 */
  subtitle?: string;
  /** markdown 格式的正文 */
  key_text: string;
  /** 来自 §2.3 的 composition_id */
  composition: CompositionId;

  /** 仅 cover 卡片有 */
  cover_hook?: CoverHookId;

  /** 强调词（每张都有） */
  emphasis_words: Array<{
    text: string;
    kind: EmphasisKind;
    weight: EmphasisWeight;
  }>;

  /** 仅部分卡片有（每 3 张正文 1 个 / 收尾必带） */
  content_trigger?: { type: TriggerKind; phrase: string };
}

/** SPEC §2.6.1 输出 Schema */
export interface AnalyzeOutput {
  topic: string;
  task_title: string;
  content_type:
    | "knowledge"
    | "book-notes"
    | "how-to"
    | "review"
    | "motivation"
    | "list"
    | "comparison"
    | "story";
  audience_signal: string;
  language: "zh-CN";
  /** 5-12 范围 */
  recommended_count: number;
  cards: AnalyzeCard[];

  /** M2.7 LLM 真推荐(仅 input.autoStyle=true 时有值) */
  recommended_style?: string;
  /** 推荐风格的简短理由(透明化,UI 展示) */
  recommended_style_reason?: string;
  /** M2.7 LLM 真推荐(仅 input.autoRatio=true 时有值) */
  recommended_ratio?: string;
}

/** 解析校验失败的细分错误，便于 caller 决定重试策略（参 §2.6.1 错误处理表） */
export type AnalyzeParseError =
  | { kind: "non_json"; raw: string; cause: unknown }
  | { kind: "missing_field"; path: string }
  | { kind: "bad_role_at_boundary"; index: number; got: string }
  | { kind: "composition_in_avoid_list"; index: number; id: string }
  | { kind: "count_out_of_range"; got: number };

// ─────────────────────── system prompt 拼装 ───────────────────────

/**
 * SPEC §2.6.1 的 system prompt 三大段落：
 *   ① 30 构图库（id + nameZh + suitableFor + recommendedRoles），紧凑列表，让 LLM 选 id
 *   ② 当前风格约束（viralIntensity / emojiPolicy / preferred* / avoid*）
 *   ③ 爆款基因 4 模块的 viralIntensity gate（封面钩子 / 标题句式 / 反爆款黑名单 / 触发器 / emphasis）
 *
 * 设计成"风格相关字段后置"，让 §2.3 的 30 构图库静态前缀
 * 在 prompt cache 里命中（SPEC §5.3.2 prompt-caching）。
 */
export function buildAnalyzeSystemPrompt(style: CardStyle): string {
  return [
    SYSTEM_HEADER,
    "",
    "# 30 种构图库（你必须为每张卡片从中选 1 个 composition_id）",
    "",
    renderCompositionsCatalog(),
    "",
    "# 爆款基因 4 模块（按风格 viralIntensity gate 注入）",
    "",
    renderViralCatalog(),
    "",
    "# 当前风格约束",
    "",
    renderStyleConstraints(style),
    "",
    "# 必须遵守的硬规则",
    "",
    renderHardRules(style),
  ].join("\n");
}

const SYSTEM_HEADER = [
  "你是 AnySlide 的内容分析 agent。任务：把用户原始内容转化为结构化的卡片大纲，",
  "agent 后续会用这份大纲调 gpt-image-2 出图。",
  "",
  "输出必须是严格 JSON（无 markdown 围栏、无解释文字、可直接 JSON.parse）。",
].join("\n");

function renderCompositionsCatalog(): string {
  // 按 SPEC §2.3 / §2.3.1 的分组顺序：30 正文 + 4 封面 + 3 收尾
  const sections: Array<{ title: string; items: typeof ALL_COMPOSITIONS }> = [
    { title: "正文构图（30 个，role=content）", items: CONTENT_COMPOSITIONS },
    { title: "封面构图（4 个，role=cover）", items: COVER_COMPOSITIONS },
    { title: "收尾构图（3 个，role=closing）", items: CLOSING_COMPOSITIONS },
  ];
  return sections
    .map((s) => {
      const lines = s.items.map(
        (c) =>
          `- \`${c.id}\` [${c.nameZh}] — ${c.suitableFor}（roles: ${c.recommendedRoles.join("/")}）`,
      );
      return `## ${s.title}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

function renderViralCatalog(): string {
  const hookList = COVER_HOOKS.map(
    (h) => `- \`${h.id}\` [${h.zhName}] — ${h.scenario}：${h.example}`,
  ).join("\n");

  const titleList = TITLE_PATTERNS.map(
    (p) => `- \`${p.id}\` [${p.zhName}] — ${p.structure}（适用：${p.whenToUse}）`,
  ).join("\n");

  const triggerList = CONTENT_TRIGGERS.map(
    (t) =>
      `- \`${t.kind}\` [${t.zhName}] — 句式池：${t.phrases.join(" / ")}（${t.whenToUse}）`,
  ).join("\n");

  const banned = BANNED_PHRASES.join(" / ");

  return [
    "## 封面钩子（cover_hook，§2.5.1）",
    hookList,
    "",
    "## 标题句式（§2.5.2）",
    titleList,
    "",
    "## 反爆款黑名单（任何风格禁用，§2.5.3）",
    banned,
    "",
    "## 正文转化触发器（content_trigger，§2.5.4）",
    triggerList,
    "",
    "## emphasis_words 强调分级（§2.5.5）",
    [
      "- kind=number / outcome / contrarian → 永远 primary",
      "- kind=identity / pain → 永远 secondary",
      "- kind=urgency → 仅 closing 卡片可用，secondary",
    ].join("\n"),
  ].join("\n");
}

function renderStyleConstraints(style: CardStyle): string {
  const stacking = getStackingRule(style.viralIntensity);
  const limits = getEmphasisLimits(style.viralIntensity);
  const allowedHooks = getAvailableCoverHooks(style.viralIntensity);
  const allowedTriggers = getAvailableTriggers(style.viralIntensity);

  const lines: string[] = [
    `风格 ID：${style.id}（${style.name}）`,
    `viralIntensity：${style.viralIntensity}`,
    `emojiPolicy：${style.emojiPolicy}`,
    `preferredCompositions：${style.preferredCompositions.join(", ")}`,
    `avoidCompositions：${style.avoidCompositions.join(", ") || "（无）"}`,
    `preferredCovers：${style.preferredCovers.join(", ")}`,
    "",
    "## 爆款 gate（按 viralIntensity 实时锁定）",
    `- 封面钩子允许集：${allowedHooks.join(", ")}`,
    `- 标题句式叠加：${stacking.strength}（${stacking.minPatterns}-${stacking.maxPatterns} 种），允许 ${stacking.allowedPatterns.join("/")}；示例 ${stacking.exampleStack}`,
    `- 内容触发器允许集：${allowedTriggers.length > 0 ? allowedTriggers.join(", ") : "（low 风格禁用）"}`,
    `- emphasis 上下限：primary ${limits.primary.min}-${limits.primary.max} / secondary ${limits.secondary.min}-${limits.secondary.max}；字号差距 ${limits.fontSizeContrast}`,
  ];
  return lines.join("\n");
}

function renderHardRules(style: CardStyle): string {
  const closingPool = CLOSING_COMPOSITIONS.map((c) => `\`${c.id}\``).join(" / ");
  return [
    "1. 第 1 张永远是 cover，构图必须从 preferredCovers 中选",
    `2. 最后 1 张永远是 closing，构图从 ${closingPool} 中选`,
    "3. 中间卡片构图必须在 30 正文构图库 ∩（preferredCompositions ∪ 其它正文 id），不能在 avoidCompositions 中",
    "4. 不连续重复构图（避免 3 张连续 stacked_cards）",
    "5. 中文输出（语言锁定 zh-CN）",
    `6. emoji 数量遵守 emojiPolicy=${style.emojiPolicy}：`,
    "   - none: 完全没有 emoji",
    "   - sparse: 封面 1-2 个 / 正文每张 ≤ 1 个 / 收尾 1-2 个",
    "   - rich: 封面 2-3 个 / 正文每张 1-2 个 / 收尾 2-3 个",
    "7. key_text 用 markdown（**粗体**、bullets、数字列表）让结构清晰",
    "8. 不要凭空编造内容，只基于用户输入重组；信息不足时在 key_text 里标 [需用户补充]",
    "9. content_trigger 写进 key_text 作为正文一部分，**不要**做独立字段（输出 schema 仍要求按 type+phrase 结构化返回，方便后续分析）",
    "10. 标题不得命中反爆款黑名单（§2.5.3）",
    "11. recommended_count ∈ [5,12]，如用户期望超出则截断到 12",
  ].join("\n");
}

// ─────────────────────── user prompt ───────────────────────

export function buildAnalyzeUserPrompt(input: AnalyzeInput): string {
  const targetCount =
    typeof input.targetCount === "number"
      ? `${input.targetCount}`
      : "由你推荐 5-12 张";
  const template = input.template
    ? JSON.stringify(input.template)
    : "未选模板";
  const research = input.researchContext?.trim()
    ? input.researchContext
    : "无";
  const intent = input.userIntent?.trim() ? input.userIntent : "未指定";

  return [
    "# 用户输入",
    "<userContent>",
    input.userContent,
    "</userContent>",
    "",
    "# 用户附加意图（可能为空）",
    `<userIntent>${intent}</userIntent>`,
    "",
    "# 模板预设（可能为空）",
    `<template>${template}</template>`,
    "",
    "# 联网调研补充材料（可能为空）",
    "<research>",
    research,
    "</research>",
    "",
    "# 比例",
    `<ratio>${input.ratio}</ratio>`,
    "",
    "# 期望张数",
    `<targetCount>${targetCount}</targetCount>`,
    "",
    ...buildAutoRecommendationBlock(input),
    "",
    "现在按上面的规则直接输出 AnalyzeOutput JSON。",
    "重要:直接给出顶层 JSON,**不要**包裹在 `analysis` / `response` / `data` / `result` 等字段内,",
    "**不要**用 markdown 围栏,**不要**写解释或思考过程,**只输出可被 JSON.parse 的纯 JSON**。",
    "字段名严格使用:`topic` / `task_title` / `content_type` / `audience_signal` / `language` / `recommended_count` / `cards`。",
    "每张卡片字段名:`index` / `role` / `title` / `subtitle` / `key_text` / `composition` / `cover_hook` / `emphasis_words` / `content_trigger`。",
    "emphasis_words 元素字段名:`text` / `kind` / `weight`(不是 word/level)。",
  ].join("\n");
}

/**
 * M2.7:autoStyle / autoRatio 时,在 user prompt 里加一段推荐指令,
 * 让 LLM 把基于内容主题的最佳风格 / 比例输出到 outline 顶层字段。
 */
function buildAutoRecommendationBlock(input: AnalyzeInput): string[] {
  if (!input.autoStyle && !input.autoRatio) return [];
  const lines: string[] = ["# AI 推荐(用户没显式选择,需要你基于内容主题推荐)"];
  if (input.autoStyle) {
    lines.push(
      "## recommended_style",
      "用户对风格选了 'AI 推荐'(没指定具体风格)。请你基于内容主题、目标受众、内容形态,在以下 6 个 cards 风格中选一个最合适的:",
      "  - `xiaohongshu_fresh`(小红书清新):干货/教程/读书笔记/生活,muted pastels",
      "  - `minimal_whitespace`(极简留白):严肃专业/数据/瑞士网格,黑白灰+1点缀",
      "  - `japanese_healing`(日系治愈):温情/生活/治愈系,米色+水蓝+砖红",
      "  - `vintage_magazine`(复古杂志):editorial/深度/财经,衬线+CMYK 颗粒",
      "  - `thick_paint_illustration`(厚涂插画):故事/隐喻/儿童,吉卜力油画感",
      "  - `ink_chinese`(国风水墨):古典/哲学/传统文化,墨黑+朱红+宣纸",
      "把推荐的 id 输出到顶层 `recommended_style` 字段(snake_case),",
      "把简短的推荐理由(<50 字)输出到 `recommended_style_reason` 字段。",
    );
  }
  if (input.autoRatio) {
    lines.push(
      "## recommended_ratio",
      "用户对比例选了 'AI 推荐'。请基于内容形态推荐:",
      "  - 干货笔记 / 多文字内容 → '3:4'",
      "  - 数据图 / 简短金句 → '1:1'",
      "  - 全屏沉浸 / 故事感 → '9:16'",
      "  - 编辑栏 / 杂志版式 → '4:5'",
      "把推荐的 id 输出到顶层 `recommended_ratio` 字段(只能是 '3:4' / '4:5' / '1:1' / '9:16' 之一)。",
    );
  }
  return lines;
}

/** 一次性返回 system + user，便于 caller 直接交给 §5.3 AI Adapter */
export function buildAnalyzeMessages(input: AnalyzeInput): {
  system: string;
  user: string;
} {
  return {
    system: buildAnalyzeSystemPrompt(input.style),
    user: buildAnalyzeUserPrompt(input),
  };
}

// ─────────────────────── 解析与校验 ───────────────────────

/**
 * SPEC §2.6.1 错误处理表 — 解析阶段的硬校验。
 *
 * 实测发现 DeepSeek V4 Flash 输出经常用变体字段名(id↔index、composition_id↔composition、
 * word/level↔text/weight、cover_hook 嵌套 object 等)。这里加 normalizer 兼容,
 * 同时为 SPEC 要求但实际没用到的顶层字段(topic / task_title / content_type / audience_signal)
 * 提供 fallback,避免把 LLM 输出严格校验当成 brick wall。
 */
export function parseAnalyzeOutput(
  raw: string,
  ctx: { style: CardStyle },
): { ok: true; output: AnalyzeOutput } | { ok: false; error: AnalyzeParseError } {
  let parsed: unknown;
  try {
    // 兜底:有些 LLM 会在 JSON 外包裹 ```json``` 围栏,简单剥掉
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    parsed = JSON.parse(stripped);
  } catch (e) {
    return { ok: false, error: { kind: "non_json", raw, cause: e } };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: { kind: "missing_field", path: "$" } };
  }

  // cards 是必须的(没 cards 没法生图)
  const rawCards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return { ok: false, error: { kind: "missing_field", path: "cards" } };
  }

  // recommended_count:有就用,没有就用 cards 长度
  let recommended =
    (parsed as { recommended_count?: number }).recommended_count ?? rawCards.length;
  if (typeof recommended !== "number" || recommended < 1) {
    recommended = rawCards.length;
  }
  const clamped = Math.min(12, recommended);

  // normalize 每张卡片
  const cards: AnalyzeCard[] = [];
  for (let i = 0; i < rawCards.length; i++) {
    const c = rawCards[i] as Record<string, unknown>;
    if (!isObject(c)) {
      return { ok: false, error: { kind: "missing_field", path: `cards[${i}]` } };
    }
    cards.push(normalizeCard(c, i));
  }

  // 边界角色:首张兜底为 cover,末张兜底为 closing(LLM 偶尔输出 content,这里强制纠正)
  if (cards[0].role !== "cover") cards[0].role = "cover";
  if (cards[cards.length - 1].role !== "closing") {
    cards[cards.length - 1].role = "closing";
  }

  // avoidCompositions 检查 — 命中 avoid 列表时降级为 stacked_cards 兜底,不直接 fail
  const avoid = new Set(ctx.style.avoidCompositions);
  for (const c of cards) {
    if (avoid.has(c.composition)) {
      c.composition = "stacked_cards";
    }
  }

  // 顶层 metadata 字段 fallback(SPEC 要求但 LLM 实测有时省略)
  const topRec = parsed as Record<string, unknown>;
  const topic = stringOr(topRec.topic, cards[0]?.title ?? "未命名");
  const task_title = stringOr(
    topRec.task_title,
    `${topic} · ${cards.length} 张`,
  );
  const content_type =
    (typeof topRec.content_type === "string"
      ? topRec.content_type
      : "knowledge") as AnalyzeOutput["content_type"];
  const audience_signal = stringOr(topRec.audience_signal, "通用受众");

  // M2.7 推荐字段(可选,仅 LLM 真给了才存)
  const recommended_style = optString(topRec.recommended_style);
  const recommended_style_reason = optString(topRec.recommended_style_reason);
  const recommended_ratio = optString(topRec.recommended_ratio);

  const output: AnalyzeOutput = {
    topic,
    task_title,
    content_type,
    audience_signal,
    language: "zh-CN",
    recommended_count: clamped,
    cards,
    ...(recommended_style ? { recommended_style } : {}),
    ...(recommended_style_reason ? { recommended_style_reason } : {}),
    ...(recommended_ratio ? { recommended_ratio } : {}),
  };
  return { ok: true, output };
}

function optString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

// ─────────────────────── 单卡片归一化(兼容 LLM 字段名变体) ───────────────────────

function normalizeCard(c: Record<string, unknown>, i: number): AnalyzeCard {
  // index 永远 1-based,与位置对齐(LLM 时 0-base 时 1-base 不一致,直接强制覆盖)
  const index = i + 1;

  // role ← role(string)
  const roleRaw = String(c.role ?? "content").toLowerCase();
  const role: AnalyzeCard["role"] =
    roleRaw === "cover" || roleRaw === "closing" ? roleRaw : "content";

  // composition ← composition | composition_id
  const composition = String(
    c.composition ?? c.composition_id ?? "stacked_cards",
  );

  // title / subtitle / key_text(直接字符串)
  const title = String(c.title ?? "").slice(0, 100);
  const subtitle =
    typeof c.subtitle === "string" && c.subtitle ? c.subtitle : undefined;
  const key_text = String(c.key_text ?? c.body ?? c.content ?? "");

  // cover_hook ← string | { type } | { id } | undefined
  let cover_hook: AnalyzeCard["cover_hook"];
  if (typeof c.cover_hook === "string") {
    cover_hook = c.cover_hook as AnalyzeCard["cover_hook"];
  } else if (isObject(c.cover_hook)) {
    const ch = c.cover_hook as { type?: string; id?: string };
    cover_hook = (ch.type ?? ch.id) as AnalyzeCard["cover_hook"] | undefined;
  }

  // emphasis_words 数组,每项支持 {text,kind,weight} 或 {word,kind,level}
  const ew = Array.isArray(c.emphasis_words) ? c.emphasis_words : [];
  const emphasis_words: AnalyzeCard["emphasis_words"] = ew
    .map((w: unknown) => {
      if (!isObject(w)) return null;
      const text = String(w.text ?? w.word ?? "");
      if (!text) return null;
      const kind = String(w.kind ?? "outcome") as AnalyzeCard["emphasis_words"][number]["kind"];
      const weightRaw = String(w.weight ?? w.level ?? "primary").toLowerCase();
      const weight: AnalyzeCard["emphasis_words"][number]["weight"] =
        weightRaw === "secondary" ? "secondary" : "primary";
      return { text, kind, weight };
    })
    .filter((x): x is AnalyzeCard["emphasis_words"][number] => x !== null);

  // content_trigger ← { type, phrase } | null
  let content_trigger: AnalyzeCard["content_trigger"];
  if (isObject(c.content_trigger)) {
    const ct = c.content_trigger as { type?: string; kind?: string; phrase?: string };
    const type = String(ct.type ?? ct.kind ?? "save") as AnalyzeCard["content_trigger"] extends infer T
      ? T extends { type: infer U }
        ? U
        : never
      : never;
    if (ct.phrase) content_trigger = { type, phrase: String(ct.phrase) };
  }

  return {
    index,
    role,
    title,
    subtitle,
    key_text,
    composition: composition as AnalyzeCard["composition"],
    cover_hook,
    emphasis_words,
    content_trigger,
  };
}

// ─────────────────────── 调用配置（占位） ───────────────────────

/**
 * SPEC §2.6.1 调用配置：
 *
 *   const response = await ai.claude.complete({
 *     system: buildAnalyzeSystemPrompt(style),   // 含 30 构图 + 风格 + 爆款，启用 ephemeral 缓存
 *     user: buildAnalyzeUserPrompt(input),
 *     model: 'mid',                              // 默认 sonnet-4.6；用户档 'high' → opus-4.7
 *     maxTokens: 4096,
 *     temperature: 0.7,
 *     cache: true,                               // §5.3.2 prompt-caching，命中后第二次起 cost ≈ 10%
 *   });
 *   const parsed = parseAnalyzeOutput(response.text, { style });
 *
 * AI Adapter（src/lib/ai/）尚未落地，调用入口在 §5.3 PR 中补；
 * 本文件保持纯函数（zero side effect），方便单元测试。
 */
export const ANALYZE_CALL_CONFIG = {
  model: { default: "claude-sonnet-4-6", high: "claude-opus-4-7" } as const,
  maxTokens: 4096,
  temperature: 0.7,
  cacheSystem: true,
} as const;
