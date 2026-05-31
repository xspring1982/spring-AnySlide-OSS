// SPEC §3.5.1 — Slides analyze prompt
//
// 与 cards 不同:slides outline 是层级结构(cover / agenda / sections / closing),
// 没有爆款基因,但有 layout_id(L1)或 visual_pattern(L2)二选一互斥。

import { ALL_L1_LAYOUTS } from "../layouts";
import { ALL_L2_PATTERNS } from "../visual-patterns";
import type { SlideStyle } from "../styles/types";
import type {
  GenerationPath,
  SlideEntry,
  SlidesAnalyzeInput,
  SlidesAnalyzeOutput,
  SlidesAnalyzeParseError,
  NarrativeArc,
} from "./types";
import type { L1LayoutId } from "../layouts/types";
import type { L2PatternId } from "../visual-patterns/types";
import type { Locale } from "@/i18n/routing";
import { LOCALE_NATIVE_NAME, LOCALE_TYPOGRAPHY_RULES } from "@/i18n/locale-util";

// ─────────────────────── system prompt ───────────────────────

export function buildSlidesAnalyzeSystemPrompt(
  style: SlideStyle,
  generationPath: GenerationPath,
  locale: Locale = "zh",
): string {
  const langName = LOCALE_NATIVE_NAME[locale];
  const lines: string[] = [
    SYSTEM_HEADER,
    "",
    `# 输出语言(强制)`,
    `所有 outline 字段(title / subtitle / bullets / body / callout / visual_hint / speaker_notes 等)`,
    `**必须用 ${langName} 输出**。顶层 language 字段填 "${locale}"。`,
    "",
    LOCALE_TYPOGRAPHY_RULES[locale],
    "",
    "# 当前风格约束",
    `风格 ID:${style.id}(${style.name})`,
    `调性:${style.oneLineDesc}`,
    `emojiPolicy:${style.emojiPolicy}`,
    `supports:${style.supports.join(", ")}`,
    `compatibleLayouts:${style.compatibleLayouts.join(", ")}`,
    "",
    `# 当前生成路径:${generationPath}`,
    "",
  ];

  if (generationPath === "L1") {
    lines.push(
      "## L1 路径规则",
      `你必须为每张 slide 选 1 个 layout_id,**只能从 compatibleLayouts 内选**(${style.compatibleLayouts.join("/")})。`,
      "visual_pattern 字段必须为 null。",
      "",
      "## 10 个 universal layouts",
      ...ALL_L1_LAYOUTS.map(
        (l) =>
          `- \`${l.id}\` [${l.name}] · ${l.category} · ${l.scenario};关键词:${l.selectionKeywords.join(" / ")}`,
      ),
    );
  } else {
    lines.push(
      "## L2 路径规则",
      "你必须为每张 slide 选 1 个 visual_pattern,24 个全开放。",
      "layout_id 字段必须为 null。",
      "注意:`comparison-matrix` / `dashboard` reliability=low,应避免;若内容确需,在 visual_hint 提示\"建议切 L1\"。",
      "",
      "## 24 个 visual_patterns",
      ...ALL_L2_PATTERNS.map(
        (p) =>
          `- \`${p.id}\` [${p.name}] · ${p.category} · reliability=${p.reliability} · ${p.scenario};关键词:${p.selectionKeywords.join(" / ")}`,
      ),
    );
  }

  lines.push(
    "",
    "# 7 种 narrative_arc(必选 1)",
    "- problem_solution:问题 → 方案",
    "- past_present_future:过去 → 现在 → 未来",
    "- what_why_how:是什么 → 为什么 → 怎么做",
    "- five_stages:五阶段进程",
    "- compare_contrast:多方对比",
    "- case_study:背景 → 困境 → 转折 → 结果",
    "- free_form:自由结构(长 deck 默认)",
    "",
    "# 张数推荐规则",
    "- 内容 < 800 字 → 6-10 张",
    "- 内容 800-3000 字 → 12-20 张",
    "- 内容 > 3000 字 → 24+ 张",
    "- recommended_count ≥ 12 必插 agenda;≥ 16 在 sections 间插 section_divider",
    "",
    "# 必须遵守",
    "1. cover 必选 hero-cover(L1) 或 title-hero(L2)",
    "2. closing 选 act-divider/big-quote(L1) 或 quote-callout/title-hero(L2)",
    "3. content slide 依内容关键词匹配 selectionKeywords",
    "4. 同 layout/pattern 不连续 3 张以上重复",
    "5. 输出严格 JSON,无 markdown 围栏",
    "",
    "# 输出 schema(顶层字段)",
    `topic / task_title / audience_signal / use_case / language='${locale}' / narrative_arc / recommended_count / speaker_notes_required / outline:{cover, agenda?, sections:[{divider?, slides:[]}], closing}`,
    "每个 SlideEntry:index / role / title / subtitle? / bullets? / body? / callout? / visual_hint? / speaker_notes? / layout_id?(L1) / visual_pattern?(L2)",
  );

  return lines.join("\n");
}

const SYSTEM_HEADER = [
  "你是 AnySlide 的 slides 内容分析 agent。任务:把用户原始内容转化为结构化的层级 slide 大纲。",
  "agent 后续会按生成路径(L1 HTML / L2 AI 图)拼装最终 prompt。",
  "",
  "输出必须是严格 JSON(无 markdown 围栏,无解释,可直接 JSON.parse)。",
].join("\n");

// ─────────────────────── user prompt ───────────────────────

/**
 * 2026-05-05 Bug 4 修:从用户输入提取明确指定的页数
 * 匹配 "3 页" / "5 张" / "8页" / "做 N 页" / "N pages" / "N slides" 等
 * 返回 number 或 undefined
 */
export function extractTargetPageCount(text: string): number | undefined {
  if (!text) return undefined;
  // 中文:N 页/张(空格可选)
  const cn = text.match(/(\d+)\s*[页张]/);
  if (cn) {
    const n = parseInt(cn[1], 10);
    if (n >= 1 && n <= 40) return n;
  }
  // 英文:N pages/slides
  const en = text.match(/(\d+)\s*(pages?|slides?)/i);
  if (en) {
    const n = parseInt(en[1], 10);
    if (n >= 1 && n <= 40) return n;
  }
  return undefined;
}

export function buildSlidesAnalyzeUserPrompt(input: SlidesAnalyzeInput): string {
  const lines: string[] = [
    "# 用户输入",
    "<userContent>",
    input.userContent,
    "</userContent>",
    "",
    `# 用户附加意图`,
    `<userIntent>${input.userIntent ?? "未指定"}</userIntent>`,
    "",
    `# 模板预设`,
    `<template>${input.template ? JSON.stringify(input.template) : "未选模板"}</template>`,
    "",
    `# 澄清答案(可能为空)`,
    `<clarifyAnswers>${input.clarifyAnswers ? JSON.stringify(input.clarifyAnswers) : "未填"}</clarifyAnswers>`,
    "",
    `# 联网调研补充材料`,
    "<research>",
    input.researchContext?.trim() || "无",
    "</research>",
    "",
    `# 比例`,
    `<ratio>${input.ratio}</ratio>`,
    "",
    `# 期望张数`,
    `<targetCount>${input.targetCount ?? "由你推荐"}</targetCount>`,
    "",
  ];

  // 2026-05-05 Bug 4 修:用户明确指定页数时,加 HARD 约束覆盖系统软规则
  if (typeof input.targetCount === "number") {
    lines.push(
      "# ⚠️ 硬性约束(必须严格遵守,优先级高于上面所有软规则)",
      `用户在输入中明确要求 **${input.targetCount} 张** 幻灯片。`,
      `recommended_count MUST 严格等于 ${input.targetCount}。`,
      `outline.cover (1) + outline.agenda (0/1) + sections.flatMap(s => [s.divider?, ...s.slides]) + outline.closing (1)`,
      `所有 slide 加起来必须 = ${input.targetCount} 张,**多一张少一张都不允许**。`,
      `如果 ${input.targetCount} < 6,**禁止** agenda 和 section_divider,直接 cover + content×N + closing。`,
      "",
    );
  }

  // M5.B 接 cards M2.7 同款 AI 推荐风格 / 比例
  if (input.autoStyle || input.autoRatio) {
    lines.push("# AI 推荐(用户没显式选择,需基于内容主题推荐)");
    if (input.autoStyle) {
      lines.push(
        "用户对风格选了 'AI 推荐',请基于内容主题在 6 风格中选一个最合适的:",
        "  - modern_pro(现代专业):路演 / 汇报 / 大胆现代",
        "  - elegant_dark(优雅暗纹):深色 / 学术质感 / 衬线",
        "  - academic_serif(学术衬线):白底 / 论文 / 严肃",
        "  - ink_classic(墨水经典):杂志风 / 编辑 / 经典",
        "  - pink_girl(粉色少女):桃粉 / 玩味 / 生活",
        "  - swiss_grid(瑞士网格):严格对齐 / 红黑 / 极简",
        "把推荐 id 输出到顶层 `recommended_style`,理由(<50 字)输出到 `recommended_style_reason`。",
      );
    }
    if (input.autoRatio) {
      lines.push(
        "用户对比例选了 'AI 推荐',基于使用场景推荐:",
        "  - 演讲 / 路演 → '16:9'",
        "  - 文档 / 网页 → '4:3'",
        "  - 移动端 / 朋友圈 → '9:16'",
        "把推荐输出到顶层 `recommended_ratio`。",
      );
    }
    lines.push("");
  }

  lines.push(
    "现在按上面规则直接输出 SlidesAnalyzeOutput JSON。",
    "重要:直接给出顶层 JSON,**不要**包裹在 `analysis` / `data` / `result` 内。",
    "**不要**用 markdown 围栏,**不要**写解释,**只输出可被 JSON.parse 的纯 JSON**。",
    `字段名严格按 SPEC §3.5.1。${input.generationPath === "L1" ? "每张 slide 必填 layout_id(从 compatibleLayouts 选)" : "每张 slide 必填 visual_pattern(24 选 1)"}。`,
  );

  return lines.join("\n");
}

export function buildSlidesAnalyzeMessages(input: SlidesAnalyzeInput): {
  system: string;
  user: string;
} {
  return {
    system: buildSlidesAnalyzeSystemPrompt(input.style, input.generationPath, input.locale ?? "zh"),
    user: buildSlidesAnalyzeUserPrompt(input),
  };
}

// ─────────────────────── 解析与校验 ───────────────────────

export function parseSlidesAnalyzeOutput(
  raw: string,
  ctx: { style: SlideStyle; generationPath: GenerationPath; locale?: Locale },
):
  | { ok: true; output: SlidesAnalyzeOutput }
  | { ok: false; error: SlidesAnalyzeParseError } {
  let parsed: unknown;
  try {
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

  const top = parsed as Record<string, unknown>;
  const outlineRaw = top.outline;
  if (!isObject(outlineRaw)) {
    return { ok: false, error: { kind: "missing_field", path: "outline" } };
  }
  const outline = outlineRaw as Record<string, unknown>;
  if (!outline.cover || !outline.closing) {
    return {
      ok: false,
      error: { kind: "missing_field", path: "outline.cover/closing" },
    };
  }
  if (!Array.isArray(outline.sections)) {
    return { ok: false, error: { kind: "missing_field", path: "outline.sections" } };
  }

  // 全局 index 重排 + 字段 normalize
  let runningIndex = 1;
  const compatLayouts = new Set(ctx.style.compatibleLayouts);
  const validPatterns = new Set(ALL_L2_PATTERNS.map((p) => p.id));

  const cover = normalizeSlide(
    outline.cover as Record<string, unknown>,
    runningIndex++,
    "cover",
    ctx.generationPath,
    compatLayouts,
    validPatterns,
  );
  let agenda: SlideEntry | undefined;
  if (isObject(outline.agenda)) {
    agenda = normalizeSlide(
      outline.agenda as Record<string, unknown>,
      runningIndex++,
      "agenda",
      ctx.generationPath,
      compatLayouts,
      validPatterns,
    );
  }
  const sections: SlidesAnalyzeOutput["outline"]["sections"] = [];
  for (const sRaw of outline.sections as unknown[]) {
    if (!isObject(sRaw)) continue;
    const s = sRaw as Record<string, unknown>;
    let divider: SlideEntry | undefined;
    if (isObject(s.divider)) {
      divider = normalizeSlide(
        s.divider as Record<string, unknown>,
        runningIndex++,
        "section_divider",
        ctx.generationPath,
        compatLayouts,
        validPatterns,
      );
    }
    const slidesArr = Array.isArray(s.slides) ? (s.slides as unknown[]) : [];
    const slides: SlideEntry[] = [];
    for (const ss of slidesArr) {
      if (!isObject(ss)) continue;
      slides.push(
        normalizeSlide(
          ss as Record<string, unknown>,
          runningIndex++,
          "content",
          ctx.generationPath,
          compatLayouts,
          validPatterns,
        ),
      );
    }
    sections.push({ divider, slides });
  }
  const closing = normalizeSlide(
    outline.closing as Record<string, unknown>,
    runningIndex++,
    "closing",
    ctx.generationPath,
    compatLayouts,
    validPatterns,
  );

  const finalOutline: SlidesAnalyzeOutput = {
    topic: stringOr(top.topic, cover.title || "未命名"),
    task_title: stringOr(top.task_title, `${stringOr(top.topic, "未命名")} · ${runningIndex - 1} 张`),
    audience_signal: stringOr(top.audience_signal, "通用受众"),
    use_case: stringOr(top.use_case, "通用"),
    language: ctx.locale ?? "zh",
    narrative_arc: ((typeof top.narrative_arc === "string"
      ? top.narrative_arc
      : "free_form") as NarrativeArc),
    recommended_count: typeof top.recommended_count === "number"
      ? Math.max(1, Math.min(40, top.recommended_count))
      : runningIndex - 1,
    speaker_notes_required: top.speaker_notes_required === true,
    outline: { cover, agenda, sections, closing },
    ...(typeof top.recommended_style === "string" && top.recommended_style.trim()
      ? { recommended_style: top.recommended_style.trim() }
      : {}),
    ...(typeof top.recommended_style_reason === "string" && top.recommended_style_reason.trim()
      ? { recommended_style_reason: top.recommended_style_reason.trim() }
      : {}),
    ...(typeof top.recommended_ratio === "string" && top.recommended_ratio.trim()
      ? { recommended_ratio: top.recommended_ratio.trim() }
      : {}),
  };

  return { ok: true, output: finalOutline };
}

// ─────────────────────── helpers ───────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function normalizeSlide(
  raw: Record<string, unknown>,
  index: number,
  defaultRole: SlideEntry["role"],
  path: GenerationPath,
  compatLayouts: Set<string>,
  validPatterns: Set<string>,
): SlideEntry {
  const role = ((typeof raw.role === "string" ? raw.role : defaultRole) as SlideEntry["role"]);
  const title = String(raw.title ?? "").slice(0, 100);
  const subtitle = typeof raw.subtitle === "string" && raw.subtitle ? raw.subtitle : undefined;
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.filter((x): x is string => typeof x === "string").slice(0, 8)
    : undefined;
  const body = typeof raw.body === "string" && raw.body ? raw.body : undefined;
  const callout = typeof raw.callout === "string" && raw.callout ? raw.callout : undefined;
  const visual_hint = typeof raw.visual_hint === "string" && raw.visual_hint ? raw.visual_hint : undefined;
  const speaker_notes =
    typeof raw.speaker_notes === "string" && raw.speaker_notes ? raw.speaker_notes : undefined;

  let layout_id: L1LayoutId | undefined;
  let visual_pattern: L2PatternId | undefined;
  if (path === "L1") {
    const lid = String(raw.layout_id ?? "");
    if (compatLayouts.has(lid)) layout_id = lid as L1LayoutId;
    else {
      // 兜底:cover → hero-cover,closing → big-quote,其他 → quote-image
      layout_id =
        role === "cover"
          ? "hero-cover"
          : role === "closing"
            ? "big-quote"
            : ("quote-image" as L1LayoutId);
    }
  } else {
    const vp = String(raw.visual_pattern ?? "");
    if (validPatterns.has(vp)) visual_pattern = vp as L2PatternId;
    else {
      visual_pattern =
        role === "cover"
          ? "title-hero"
          : role === "closing"
            ? "quote-callout"
            : ("two-columns" as L2PatternId);
    }
  }

  return {
    index,
    role,
    title,
    subtitle,
    bullets,
    body,
    callout,
    visual_hint,
    speaker_notes,
    layout_id,
    visual_pattern,
  };
}

export const SLIDES_ANALYZE_CALL_CONFIG = {
  model: { default: "claude-sonnet-4-6", high: "claude-opus-4-7" } as const,
  maxTokens: 12288, // slides outline 比 cards 长(层级 + speaker_notes)
  temperature: 0.7,
  cacheSystem: true,
} as const;
