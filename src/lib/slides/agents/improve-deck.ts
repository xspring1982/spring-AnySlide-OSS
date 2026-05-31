// Phase 3 PR37:Improve LLM agent — 给草稿 blueprint "美化"
//
// 输入:
//   - 草稿 blueprint(从用户上传 PPT 解析出来的,内容已提取但版式粗糙)
//   - 用户的优化指令(可选,默认 "重新设计为简洁现代专业")
//   - 目标模板 ID(用户在 home 选的模板,如 "l1-guizang-monocle")
//
// 任务:
//   - **完全保留每页文字内容**(对标 AnyGen "while preserving every piece of original information")
//   - 智能合并 / 拆分文字(超长 bullet 自动拆短;同主题碎片 bullet 合并)
//   - 给每页加 layout_hint(parallel / comparison / timeline / big-number / single-text)
//   - 自动判断业务类型(info_sync / business_review / pitch / academic / 教育)
//   - 输出新的 blueprint(目标:LLM 不要改原文意思,只优化结构 + 排版语义)
//
// 跟 AnyGen 对照:
//   AnyGen 的 task_type "info_sync" + auto_filled clarify 就是这个 agent 在做。
//   它的 thinking 块说过:"rebuild the presentation from the ground up,
//     ensuring a clean, modern, and professional aesthetic while preserving
//     every piece of original information and optimizing its layout and typography"

import { ai } from "@/lib/ai";
import type { Locale } from "@/i18n/routing";
import type {
  DeckBlueprint,
  SlideBlueprint,
  SlotValue,
} from "../blueprint/schema";
import { normalizeLayoutIntent } from "../blueprint/layout-intent";

export interface ImproveDeckInput {
  /** 从 .pptx 解析出来的草稿 blueprint */
  draft: DeckBlueprint;
  /** 用户的优化指令,可选(默认走 "简洁现代专业" 套路) */
  userInstruction?: string;
  /** 目标模板 ID(用户在 home 选的;为空 = LLM 自动判断 + 选最合适) */
  targetTemplateId?: string;
  /** 目标语言 — 决定 LLM prompt + output 语言 */
  locale: Locale;
}

export interface ImproveDeckOutput {
  /** 美化后的 blueprint(slot 字段更精炼 + 加 layout_intent 元数据) */
  improved: DeckBlueprint;
  /** LLM 判断的业务类型(info_sync / business_review / pitch / academic / educational) */
  detected_business_type: string;
  /** LLM 的一句话总结 — 它做了什么(给用户看) */
  summary_for_user: string;
  /** 使用的模型名(透传给 metadata) */
  modelUsed: string;
}

const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
};

function buildSystem(locale: Locale): string {
  return [
    "你是 AnySlide Improve 的美化助手。",
    "用户上传了一份排版粗糙的 PPT,我已经把每页内容提取成草稿 blueprint。",
    "你的任务是 **重新美化排版**,但 **必须 100% 保留原始内容**(每个字都不能丢)。",
    "",
    `# 输出语言:${LOCALE_NAME[locale]}`,
    "",
    "# 严格的边界",
    "可以做:",
    "  - 优化每页的 slots 字段分配(把 title / lead / bullets 重新组织)",
    "  - 智能合并碎片 bullet(同主题的 3 条短句合并成 1 条流畅长句)",
    "  - 智能拆分超长 bullet(> 80 字的 bullet 拆成 2-3 条)",
    "  - 给每页打 role 标(cover / agenda / content / section_divider / closing)",
    "  - 给每页加 layout_intent 元数据,只从允许值里选",
    "  - 判断业务类型(info_sync / business_review / pitch / academic / educational)",
    "不可以做:",
    "  - **不能改变原文意思**(就算原文表达不漂亮也不要润色措辞)",
    "  - 不能删除任何关键数据(数字 / 人名 / 地名 / 公司名)",
    "  - 不能编造原 PPT 没有的内容",
    "  - 不能改 page 总数(N 页输入 = N 页输出)",
    "",
    "# 输出严格 JSON(不要 markdown 围栏不要解释):",
    JSON.stringify(
      {
        improved_slides: [
          {
            page_no: 1,
            role: "cover|agenda|content|section_divider|closing",
            layout_intent:
              "cover|agenda|single_text|bullets|big_number|comparison|timeline|quote|two_column|section_divider|closing",
            slots: { title: "...", subtitle: "...", bullets: ["..."] },
          },
        ],
        detected_business_type: "info_sync|business_review|pitch|academic|educational",
        summary_for_user: "<一句话给用户的解释 < 80 字>",
      },
      null,
      2,
    ),
    "",
    "# 核心心法",
    "你不是创作者,你是排版师。把用户已写好的内容塞进合适的版式格子,**不评价不修改不润色**。",
    "",
    "# layout_intent 选择规则",
    "- cover:封面",
    "- agenda:目录 / 议程",
    "- single_text:单段观点 / 解释型内容",
    "- bullets:列表 / 多要点",
    "- big_number:单个核心数字或 KPI",
    "- comparison:左右对比 / before-after / pros-cons",
    "- timeline:流程 / 时间线 / 阶段",
    "- quote:引用 / 金句 / 强 callout",
    "- two_column:两个并列主题但不是明确对比",
    "- section_divider:章节分隔",
    "- closing:结束页",
    "",
    "# slots 契约",
    "- cover: title, subtitle, byline",
    "- agenda: title, items[string[]]",
    "- bullets: title, lead, bullets[string[]]",
    "- single_text: title, lead, body",
    "- big_number: label, big_number, caption",
    "- comparison: title, left_title, left_items[string[]], right_title, right_items[string[]]",
    "- timeline: title, steps[string[]]",
    "- quote: quote, attribution",
    "- two_column: title, left_title, left_body, right_title, right_body",
    "- section_divider: title",
    "- closing: title, subtitle, contact",
  ].join("\n");
}

function buildUser(args: ImproveDeckInput): string {
  const { draft, userInstruction, targetTemplateId } = args;
  return [
    "# 草稿 blueprint(从用户 PPT 解析)",
    JSON.stringify(draft, null, 2).slice(0, 8000), // 给 LLM 一个上限,防大 PPT 爆 context
    "",
    `# 目标模板:${targetTemplateId ?? "(未指定,你自己判断 + 选最合适)"}`,
    "",
    "# 用户优化指令",
    userInstruction ?? "重新设计为简洁、现代、专业,但 100% 保留所有原始内容。",
    "",
    "现在直接输出 JSON,不要任何解释。",
  ].join("\n");
}

/**
 * 主入口:给草稿 blueprint 美化,输出新 blueprint。
 *
 * 抛错条件:
 *   - LLM 返回非 JSON
 *   - 缺关键字段(improved_slides / detected_business_type / summary_for_user)
 *   - page 数对不上(LLM 试图加/删页)
 */
export async function improveDeck(
  args: ImproveDeckInput,
): Promise<ImproveDeckOutput> {
  const { draft, locale } = args;

  const system = buildSystem(locale);
  const user = buildUser(args);

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 4000,
    temperature: 0.2,
    cacheSystem: false,
  });

  // 解 JSON(允许 ```json 围栏)
  const raw = completion.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`improve-deck LLM 返回非 JSON(前 200:${raw.slice(0, 200)})`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("improve-deck LLM 输出非 object");
  }
  const p = parsed as {
    improved_slides?: unknown;
    detected_business_type?: unknown;
    summary_for_user?: unknown;
  };
  if (!Array.isArray(p.improved_slides)) {
    throw new Error("improve-deck LLM 输出缺 improved_slides 数组");
  }
  if (typeof p.detected_business_type !== "string") {
    throw new Error("improve-deck LLM 输出缺 detected_business_type");
  }
  if (typeof p.summary_for_user !== "string") {
    throw new Error("improve-deck LLM 输出缺 summary_for_user");
  }
  if (p.improved_slides.length !== draft.slides.length) {
    throw new Error(
      `page 数不一致:原 ${draft.slides.length}, LLM 输出 ${p.improved_slides.length}(LLM 不能改 page 总数)`,
    );
  }

  // 组装新 blueprint(meta 保留原 draft 的,slides 用 LLM 输出)
  const improvedSlides: SlideBlueprint[] = p.improved_slides.map(
    (s: unknown, i: number) => {
      const ss = (s ?? {}) as Partial<SlideBlueprint> & {
        layout_hint?: unknown;
      };
      const fallbackSlide = draft.slides[i];
      const layoutIntent =
        normalizeLayoutIntent(ss.layout_intent) ??
        normalizeLayoutIntent(ss.layout_hint) ??
        fallbackSlide.layout_intent;
      const slots =
        ss.slots && typeof ss.slots === "object"
          ? normalizeSlots(ss.slots as Record<string, unknown>)
          : fallbackSlide.slots;
      return {
        page_no: i + 1,
        template_section_index: ss.template_section_index ?? i + 1,
        role: ss.role ?? fallbackSlide.role,
        ...(layoutIntent ? { layout_intent: layoutIntent } : {}),
        slots,
        speaker_notes: ss.speaker_notes ?? fallbackSlide.speaker_notes,
      };
    },
  );

  return {
    improved: {
      meta: draft.meta,
      slides: improvedSlides,
    },
    detected_business_type: p.detected_business_type,
    summary_for_user: p.summary_for_user,
    modelUsed: completion.model,
  };
}

function normalizeSlots(raw: Record<string, unknown>): Record<string, SlotValue> {
  const out: Record<string, SlotValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.map((x) => String(x));
    }
  }
  return out;
}
