// Phase 6 PR40 — 元素级标注修改的 LLM agent
//
// 输入:
//   - currentText: 元素当前文字(用户在 deck 上点了的)
//   - instruction: 用户的修改意见("改成 XX" / "更短" / "改成数字")
//   - context (可选):页面 role(cover/content/closing)+ 周围元素文字(给 LLM 上下文)
//
// 输出:
//   - newText: 改写后的纯文本(不带 HTML 标签)
//
// 跟 PR27 refine-deck 的对比:
//   - refine-deck: 整 deck / 整页级别,LLM 输出 slot 字段
//   - element-refine: 单元素级别,LLM 只输出一段新文本
//   - 调用频率高(用户点 5 个元素 → 5 次 LLM 调用),应当快 + 便宜
//
// 严格约束:
//   - LLM **只能输出纯文本**(不能含 HTML / Markdown 标签)
//   - 不能超长(默认 < currentText 长度 × 2,防爆版面)
//   - 不能空字符串

import { ai } from "@/lib/ai";
import type { Locale } from "@/i18n/routing";

export interface ElementRefineInput {
  currentText: string;
  instruction: string;
  /** 周围上下文给 LLM 提示(可选)*/
  context?: {
    pageRole?: string; // cover / content / closing 等
    surroundingText?: string; // 同页其他文字(只读,LLM 不能改)
    elementTag?: string; // h1 / p / li 等(暗示是标题还是正文)
  };
  locale: Locale;
}

export interface ElementRefineOutput {
  newText: string;
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
    "你是 AnySlide 的元素级文本改写助手。",
    "用户在 deck 上点了某个文字元素,告诉你怎么改。你只需输出**新文本**(纯文本,不带 HTML)。",
    "",
    `# 输出语言:${LOCALE_NAME[locale]}`,
    "",
    "# 严格规则",
    "1. **只输出新文本**,不要解释 / 不要 markdown / 不要 HTML 标签 / 不要引号包裹",
    "2. 字数尽量跟原文相近(±30%),不要爆版面",
    "3. 不要编造数据(保留原文里的数字 / 人名 / 公司名)",
    "4. 不要返回空字符串(如果用户指令矛盾,返回原文)",
    "",
    "# 输出格式",
    "直接输出新文本,**没有任何前缀 / 后缀 / 引号 / markdown**。",
  ].join("\n");
}

function buildUser(args: ElementRefineInput): string {
  const ctx = args.context;
  return [
    "# 元素当前文字",
    `"""${args.currentText}"""`,
    "",
    ctx?.elementTag ? `# 元素类型: <${ctx.elementTag}>` : "",
    ctx?.pageRole ? `# 所在页面角色: ${ctx.pageRole}` : "",
    ctx?.surroundingText
      ? `# 同页其他文字(只读,作上下文):\n"""${ctx.surroundingText.slice(0, 500)}"""`
      : "",
    "",
    "# 用户的修改指令",
    args.instruction,
    "",
    "现在直接输出改写后的新文本(纯文本,无引号无解释):",
  ]
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * 改写单个元素的文字。
 *
 * 抛错条件:
 *   - LLM 返回空字符串
 *   - LLM 输出过长(> 原文长度 × 5,防止 LLM 跑偏)
 */
export async function refineElementText(
  args: ElementRefineInput,
): Promise<ElementRefineOutput> {
  const system = buildSystem(args.locale);
  const user = buildUser(args);

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 500,
    temperature: 0.3,
    cacheSystem: false,
  });

  let newText = completion.text.trim();

  // 剥掉 LLM 可能加的引号 / markdown
  newText = newText
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/^(\*\*|__)/, "")
    .replace(/(\*\*|__)$/, "")
    .trim();

  if (newText.length === 0) {
    throw new Error("element-refine LLM 返回空字符串");
  }
  if (newText.length > args.currentText.length * 5 + 50) {
    throw new Error(
      `element-refine LLM 输出过长(${newText.length} 字,原文 ${args.currentText.length} 字)`,
    );
  }

  return { newText, modelUsed: completion.model };
}
