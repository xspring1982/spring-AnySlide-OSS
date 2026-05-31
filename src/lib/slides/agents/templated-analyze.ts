// PR15b — L1 模板填充模式专属 analyze prompt builder
//
// 跟 src/lib/slides/agents/analyze.ts 的差别:
//   - 输入额外带 template_outline(模板每个 section 的 role/title/preview)
//   - LLM 不选 layout_id / visual_pattern,而是从 template_outline 池里挑 section
//   - 输出 outline 每个 SlideEntry 带 template_section_index 引用模板 section
//   - 页数动态:LLM 基于用户主题决定,可加可减(content 页可重复用)
//
// 设计原则:
//   - 用户输入模糊 → LLM 帮他展开内容
//   - 用户明确指定页数 → 严格遵守(extractTargetPageCount)
//   - cover / closing 必须用模板自带的(每个模板都有,且视觉特殊)
//   - content / content_quote / content_columns / stat_grid 可重复使用

import type { Locale } from "@/i18n/routing";
import {
  LOCALE_NATIVE_NAME,
  LOCALE_TYPOGRAPHY_RULES,
} from "@/i18n/locale-util";
import type {
  NarrativeArc,
  SlideEntry,
  SlidesAnalyzeOutput,
} from "./types";

/** 模板 outline 中的单 section,跟 scripts/annotate-template-outlines.ts 输出对齐 */
export interface TemplateSection {
  index: number;
  role:
    | "cover"
    | "agenda"
    | "content"
    | "content_quote"
    | "content_columns"
    | "stat_grid"
    | "closing";
  title: string;
  preview: string;
}

export interface L1TemplatedAnalyzeInput {
  userContent: string;
  userIntent?: string;
  templateName: string;
  templateOutline: TemplateSection[];
  /** 用户在文字里明确指定的页数(extractTargetPageCount) */
  targetCount?: number;
  /** 任务语言 */
  locale: Locale;
  /** 联网调研补充 */
  researchContext?: string;
}

// ─────────────────────── system prompt ───────────────────────

export function buildL1TemplatedSystemPrompt(
  templateOutline: TemplateSection[],
  locale: Locale,
): string {
  const langName = LOCALE_NATIVE_NAME[locale];

  // 把模板 outline 渲染成 LLM 可读列表
  const sectionList = templateOutline
    .map(
      (s) =>
        `  - section #${s.index} [${s.role}] "${s.title}" — preview: ${s.preview.slice(0, 60)}…`,
    )
    .join("\n");

  // 找 cover / closing 的 index(LLM 必须用这两个特殊位)
  const coverIdx =
    templateOutline.find((s) => s.role === "cover")?.index ?? 1;
  const closingIdx =
    templateOutline.find((s) => s.role === "closing")?.index ??
    templateOutline.length;
  const reusable = templateOutline
    .filter(
      (s) =>
        s.role !== "cover" &&
        s.role !== "closing",
    )
    .map((s) => `#${s.index}`)
    .join(", ");

  return [
    "你是 AnySlide 的 L1 模板填充模式 outline 分析 agent。",
    "用户选了一个预设模板,你要基于用户主题 + 模板的 section 池,生成一份完整的演讲大纲。",
    "",
    `# 输出语言`,
    `所有 outline 字段(title / body / bullets / callout 等)必须用 **${langName}** 输出。`,
    `顶层 language 字段填 "${locale}"。`,
    "",
    LOCALE_TYPOGRAPHY_RULES[locale],
    "",
    "# 模板 section 池(可用作 layout)",
    sectionList,
    "",
    `# 必须遵守(任一违反 = 视为失败)`,
    `1. 第 1 张必须用 cover section(template_section_index = ${coverIdx})`,
    `2. 最后 1 张必须用 closing section(template_section_index = ${closingIdx})`,
    `3. 中间 content 页可从可复用 section [${reusable}] 里挑,允许重复用`,
    "4. 每个 SlideEntry 必填 template_section_index(从池里选,数字 1-based)",
    `5. 总页数:基于用户主题字数决定 — 短主题(<300字)5-7 张 / 中等(300-1500字)8-12 张 / 长(>1500字)12-18 张。如果用户明确指定页数,严格遵守。`,
    "6. 每张 slide 必填 title(简短有力),content 页加 body(80-200 字)和 / 或 bullets(3-5 条)",
    "7. **不要假设模板 section 的视觉**(那是 layout 的事),你只要确保选的 section role 跟内容类型匹配:",
    "   - 数据 / 数字密集 → 优先选 stat_grid(若模板池里有)",
    "   - 引用 / 名言 / 强观点 → 优先选 content_quote",
    "   - 多个并列要点 → 优先选 content_columns",
    "   - 一般叙述 → content",
    "   - 目录 / agenda → 用 agenda(若模板池里有)",
    "8. 输出严格 JSON,无 markdown 围栏,可直接 JSON.parse",
    "",
    "# 输出 schema(顶层字段)",
    `topic / task_title / audience_signal / use_case / language='${locale}' /`,
    "narrative_arc / recommended_count / speaker_notes_required /",
    "outline:{ cover, agenda?, sections:[{slides:[]}], closing }",
    "",
    "每个 SlideEntry 必填字段:index / role / title / template_section_index",
    "可选字段:subtitle / bullets / body / callout / visual_hint / speaker_notes",
    "",
    "# narrative_arc 可选 7 种",
    "- problem_solution / past_present_future / what_why_how / five_stages /",
    "  compare_contrast / case_study / free_form",
  ].join("\n");
}

// ─────────────────────── user prompt ───────────────────────

export function buildL1TemplatedUserPrompt(
  input: L1TemplatedAnalyzeInput,
): string {
  const lines: string[] = [
    "# 用户主题",
    "<userContent>",
    input.userContent,
    "</userContent>",
    "",
    "# 用户附加意图",
    `<userIntent>${input.userIntent ?? "未指定"}</userIntent>`,
    "",
    "# 已选模板",
    `<templateName>${input.templateName}</templateName>`,
    "",
    "# 联网调研补充材料",
    "<research>",
    input.researchContext?.trim() || "无",
    "</research>",
    "",
    "# 期望张数",
    `<targetCount>${input.targetCount ?? "由你基于内容量推荐"}</targetCount>`,
    "",
  ];

  if (typeof input.targetCount === "number") {
    lines.push(
      "# ⚠️ 硬性约束",
      `用户明确要求 ${input.targetCount} 张。recommended_count 必须 = ${input.targetCount}。`,
      `outline.cover (1) + outline.agenda (0/1) + sections.flatMap(s => s.slides) + outline.closing (1) = ${input.targetCount}`,
      "",
    );
  }

  lines.push(
    "现在按上面规则直接输出 SlidesAnalyzeOutput JSON。",
    "**不要**用 markdown 围栏,**不要**写解释,**只输出可被 JSON.parse 的纯 JSON**。",
    "每张 slide 的 template_section_index 必填(从模板 section 池里 1-based 挑)。",
  );

  return lines.join("\n");
}

export function buildL1TemplatedAnalyzeMessages(
  input: L1TemplatedAnalyzeInput,
): { system: string; user: string } {
  return {
    system: buildL1TemplatedSystemPrompt(input.templateOutline, input.locale),
    user: buildL1TemplatedUserPrompt(input),
  };
}

// ─────────────────────── 解析 ───────────────────────

export function parseL1TemplatedOutput(
  raw: string,
  ctx: { locale: Locale; templateOutline: TemplateSection[] },
):
  | { ok: true; output: SlidesAnalyzeOutput }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    parsed = JSON.parse(stripped);
  } catch (e) {
    return { ok: false, error: `non_json:${(e as Error).message}` };
  }
  if (!isObject(parsed)) {
    return { ok: false, error: "not_object" };
  }
  const top = parsed as Record<string, unknown>;
  const outlineRaw = top.outline;
  if (!isObject(outlineRaw)) return { ok: false, error: "missing outline" };
  const outline = outlineRaw as Record<string, unknown>;
  if (!outline.cover || !outline.closing) {
    return { ok: false, error: "missing cover/closing" };
  }
  if (!Array.isArray(outline.sections)) {
    return { ok: false, error: "missing sections array" };
  }

  const validSectionIndexes = new Set(
    ctx.templateOutline.map((s) => s.index),
  );
  let runningIndex = 1;

  const cover = normalizeTemplatedSlide(
    outline.cover as Record<string, unknown>,
    runningIndex++,
    "cover",
    validSectionIndexes,
    ctx.templateOutline,
  );
  let agenda: SlideEntry | undefined;
  if (isObject(outline.agenda)) {
    agenda = normalizeTemplatedSlide(
      outline.agenda as Record<string, unknown>,
      runningIndex++,
      "agenda",
      validSectionIndexes,
      ctx.templateOutline,
    );
  }
  const sections: SlidesAnalyzeOutput["outline"]["sections"] = [];
  for (const sRaw of outline.sections as unknown[]) {
    if (!isObject(sRaw)) continue;
    const s = sRaw as Record<string, unknown>;
    const slidesArr = Array.isArray(s.slides) ? (s.slides as unknown[]) : [];
    const slides: SlideEntry[] = [];
    for (const ss of slidesArr) {
      if (!isObject(ss)) continue;
      slides.push(
        normalizeTemplatedSlide(
          ss as Record<string, unknown>,
          runningIndex++,
          "content",
          validSectionIndexes,
          ctx.templateOutline,
        ),
      );
    }
    sections.push({ slides });
  }
  const closing = normalizeTemplatedSlide(
    outline.closing as Record<string, unknown>,
    runningIndex++,
    "closing",
    validSectionIndexes,
    ctx.templateOutline,
  );

  const finalOutline: SlidesAnalyzeOutput = {
    topic: stringOr(top.topic, cover.title || "未命名"),
    task_title: stringOr(
      top.task_title,
      `${stringOr(top.topic, "未命名")} · ${runningIndex - 1} 张`,
    ),
    audience_signal: stringOr(top.audience_signal, "通用受众"),
    use_case: stringOr(top.use_case, "通用"),
    language: ctx.locale,
    narrative_arc: ((typeof top.narrative_arc === "string"
      ? top.narrative_arc
      : "free_form") as NarrativeArc),
    recommended_count:
      typeof top.recommended_count === "number"
        ? Math.max(1, Math.min(40, top.recommended_count))
        : runningIndex - 1,
    speaker_notes_required: top.speaker_notes_required === true,
    outline: { cover, agenda, sections, closing },
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

function normalizeTemplatedSlide(
  raw: Record<string, unknown>,
  index: number,
  defaultRole: SlideEntry["role"],
  validSectionIndexes: Set<number>,
  templateOutline: TemplateSection[],
): SlideEntry {
  const role = ((typeof raw.role === "string"
    ? raw.role
    : defaultRole) as SlideEntry["role"]);
  const title = String(raw.title ?? "").slice(0, 100);
  const subtitle =
    typeof raw.subtitle === "string" && raw.subtitle ? raw.subtitle : undefined;
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.filter((x): x is string => typeof x === "string").slice(0, 8)
    : undefined;
  const body = typeof raw.body === "string" && raw.body ? raw.body : undefined;
  const callout =
    typeof raw.callout === "string" && raw.callout ? raw.callout : undefined;
  const visual_hint =
    typeof raw.visual_hint === "string" && raw.visual_hint
      ? raw.visual_hint
      : undefined;
  const speaker_notes =
    typeof raw.speaker_notes === "string" && raw.speaker_notes
      ? raw.speaker_notes
      : undefined;

  // template_section_index 兜底:role 匹配的第一个 section
  let tplIdx: number | undefined;
  const rawIdx = raw.template_section_index;
  if (typeof rawIdx === "number" && validSectionIndexes.has(rawIdx)) {
    tplIdx = rawIdx;
  } else {
    // fallback:按 role 找模板池里第一个匹配
    const match = templateOutline.find((s) => s.role === role);
    if (match) tplIdx = match.index;
    else if (templateOutline.length > 0) tplIdx = templateOutline[0].index;
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
    template_section_index: tplIdx,
  };
}
