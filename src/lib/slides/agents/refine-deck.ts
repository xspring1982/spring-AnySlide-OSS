// PR27 — Slides Refine 的"指挥层" LLM agent
//
// 职责:接收用户的整 deck 修改意见,决定**改哪几页 + 每页怎么改的简短 instruction**,
// 然后 inngest function 会对每条 edit 调一次现成的 refineL1Section() 完成实际改写。
//
// 设计取舍:
//   - 不让 LLM 直接吐 N 张新 HTML(容易超 maxTokens + 容易破坏 CSS)
//   - 改成"指挥层 + 单页改写"两段式:这里只输出结构化 edits,实际 HTML 改写复用
//     slides-template-fill.ts:refineL1Section() (已调到 temp=0.2 + 严格不动 CSS)
//
// MVP 范围(2026-05-11):
//   - 只支持改现有页内容(不加页 / 不删页 / 不换模板 / 不换风格)
//   - 越界 / 不支持的请求 → 返回 skipped + reasoning,前端展示给用户
//
// 输入:outline(只用 page titles) + 用户意见 + locale
// 输出:RefineDeckPlan(edits[] + skipped[] + reasoning)
//
// 抛错时机:LLM 返回非 JSON / 字段缺失 / 越界 pageNo 全部 throw,
// 上游 slides-refine.ts 的 onFailure 自动捕获 + 退款。

import { ai } from "@/lib/ai";
import type { Locale } from "@/i18n/routing";
import type { SlidesAnalyzeOutput } from "./types";

export interface RefineEdit {
  /** 1-based,引用 deck section 索引 */
  pageNo: number;
  /** 喂给 refineL1Section 的单页改写指令(中文,LLM 已读懂上下文压缩过) */
  instruction: string;
}

export interface RefineDeckPlan {
  edits: RefineEdit[];
  /** LLM 不打算改 / 觉得超 MVP 能力的页码或请求,前端展示给用户 */
  skipped: number[];
  /** LLM 的简短解释,给用户看 */
  reasoning: string;
}

/** 从 outline 提取 "1. 封面 - 标题" 这种平铺列表,供 LLM 当 section 索引参考 */
function flattenOutlineForPrompt(outline: SlidesAnalyzeOutput): string[] {
  const lines: string[] = [];
  let idx = 1;
  if (outline.outline.cover) {
    lines.push(`${idx++}. [cover] ${outline.outline.cover.title ?? ""}`);
  }
  if (outline.outline.agenda) {
    lines.push(`${idx++}. [agenda] ${outline.outline.agenda.title ?? ""}`);
  }
  for (const sec of outline.outline.sections ?? []) {
    for (const slide of sec.slides ?? []) {
      lines.push(
        `${idx++}. [${slide.role ?? "section"}] ${slide.title ?? ""}`,
      );
    }
  }
  if (outline.outline.closing) {
    lines.push(`${idx++}. [closing] ${outline.outline.closing.title ?? ""}`);
  }
  return lines;
}

const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
};

function buildSystem(locale: Locale, totalPages: number): string {
  return [
    "你是 AnySlide Slides Refine 的指挥层 agent。",
    "用户已经做完一份 deck,现在带着修改意见来找你。你的任务是判断:",
    "  1. 用户想改哪几页(给出 1-based pageNo)",
    "  2. 每页改成什么样(给出**简短中文 instruction**,后续单页改写 agent 会基于它改 HTML innerText)",
    "",
    `# 输出语言:用户 instruction 字段用中文(后端 prompt),最终生成的 HTML 文本会按用户 locale=${locale}(${LOCALE_NAME[locale]})走`,
    "",
    "# 严格的能力边界(MVP)",
    "可以做:",
    "  - 改某页的标题 / 正文 / bullets / callout",
    "  - 改整体语气(更活泼 / 更专业 / 更紧凑)→ 列出受影响页码",
    "不可以做(若用户要求,放进 skipped + 在 reasoning 解释):",
    "  - 加页 / 删页(deck 结构不能变)",
    "  - 换模板 / 换视觉风格(改 CSS 不在能力范围)",
    "  - 改图片 / SVG(本 agent 只处理文字)",
    "",
    `# 当前 deck 共 ${totalPages} 张`,
    "你只能在 [1, " + totalPages + "] 范围内挑 pageNo;越界一律不允许。",
    "",
    "# 输出严格 JSON(不要 markdown 围栏,不要解释):",
    "{",
    '  "edits": [{ "pageNo": <number>, "instruction": "<中文简短指令,< 80 字>" }, ...],',
    '  "skipped": [<不在能力范围的页码,可空数组>],',
    '  "reasoning": "<一句话给用户的解释,< 120 字>"',
    "}",
    "",
    "# 核心心法",
    "保守:能不改的页就别改。用户没明说 + 没暗示影响的页一律不动。",
    "克制:'整体更活泼'类请求最多改 cover + 2-3 张 section,别全改一遍(费时 + 风险大)。",
  ].join("\n");
}

function buildUser(args: {
  outlineLines: string[];
  feedback: string;
  totalPages: number;
}): string {
  return [
    "# 当前 deck 大纲(1-based):",
    args.outlineLines.join("\n"),
    "",
    `共 ${args.totalPages} 张。`,
    "",
    "# 用户修改意见:",
    args.feedback,
    "",
    "直接输出 JSON,不要任何解释。",
  ].join("\n");
}

/**
 * 调 LLM 决定 Refine 的执行计划。
 *
 * 抛错条件:
 *   - LLM 返回非 JSON
 *   - 缺 edits / skipped / reasoning 字段
 *   - edits 里有越界 pageNo(<1 或 > totalPages)
 *   - edits 为空且 skipped 为空(意味着 LLM 没判断)
 *
 * 注意:edits 为空 + skipped 非空是合法的(用户请求超能力,这时上游应当
 * 直接展示 reasoning 给用户而不是真去改 deck)。
 */
export async function planRefineDeck(args: {
  outline: SlidesAnalyzeOutput;
  totalPages: number;
  feedback: string;
  locale: Locale;
}): Promise<RefineDeckPlan & { modelUsed: string }> {
  const { outline, totalPages, feedback, locale } = args;
  const outlineLines = flattenOutlineForPrompt(outline);

  const system = buildSystem(locale, totalPages);
  const user = buildUser({ outlineLines, feedback, totalPages });

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 1200,
    temperature: 0.2,
    cacheSystem: false,
  });

  // 解 JSON(允许 ```json 围栏的兜底)
  const raw = completion.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `refine-deck LLM 返回非 JSON(前 200:${raw.slice(0, 200)})`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("refine-deck LLM 输出非 object");
  }
  const p = parsed as Partial<RefineDeckPlan>;
  if (!Array.isArray(p.edits)) {
    throw new Error("refine-deck LLM 输出缺 edits 数组");
  }
  if (!Array.isArray(p.skipped)) {
    throw new Error("refine-deck LLM 输出缺 skipped 数组");
  }
  if (typeof p.reasoning !== "string") {
    throw new Error("refine-deck LLM 输出缺 reasoning 字符串");
  }

  // 校验 pageNo 范围 + 字段
  const validEdits: RefineEdit[] = [];
  for (const e of p.edits) {
    if (!e || typeof e !== "object") continue;
    const pageNo = (e as { pageNo?: unknown }).pageNo;
    const instr = (e as { instruction?: unknown }).instruction;
    if (
      typeof pageNo === "number" &&
      Number.isInteger(pageNo) &&
      pageNo >= 1 &&
      pageNo <= totalPages &&
      typeof instr === "string" &&
      instr.trim().length > 0
    ) {
      validEdits.push({ pageNo, instruction: instr.trim() });
    }
  }

  if (validEdits.length === 0 && p.skipped.length === 0) {
    throw new Error(
      "refine-deck LLM 既没产出 edits 也没标 skipped,可能没理解意图",
    );
  }

  return {
    edits: validEdits,
    skipped: p.skipped.filter(
      (n): n is number => typeof n === "number" && Number.isInteger(n),
    ),
    reasoning: p.reasoning.trim(),
    modelUsed: completion.model,
  };
}
