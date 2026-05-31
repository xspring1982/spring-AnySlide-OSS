// SPEC §2.6.3 — prompt-assembly.ts 拼装模板
//
// **纯字符串模板，不调 Claude**。把单张卡片的 outline 数据 + 风格 schema +
// 30 构图描述 + 技术约束拼成最终 gpt-image-2 prompt。
//
// 5 段拼装顺序（SPEC §2.6.3 核心）：
//   ① 风格 promptBase 5 段
//   ② 构图 layout 描述
//   ③ 反引号锁定的内容文字 + emphasis 指令
//   ④ 爆款基因注入（cover_hook / content_trigger）
//   ⑤ 技术固定约束（语言 + 比例 + 序号）

import { getCompositionLayout } from "@/lib/cards/compositions";
import { getEmphasisLimits } from "@/lib/cards/viral";
import type { CoverHookId } from "@/lib/cards/viral";
import type { CardStyle, RatioId } from "@/lib/cards/styles/types";
import type { AnalyzeCard } from "./analyze";

// ─────────────────────── 类型 ───────────────────────

export interface AssemblyInput {
  /** 来自 outline 的单张卡片 */
  card: AnalyzeCard;
  /** 风格 schema */
  style: CardStyle;
  ratio: RatioId;
  /** 整套总张数（用于序号标记） */
  totalCount: number;
  /** 第 1 张除外，其他张携带封面图 URL 作 ref */
  anchorImageUrl?: string;
  /** 模板自带的 custom_prompt_addon */
  templateAddon?: string;
}

// ─────────────────────── 常量映射 ───────────────────────

/** SPEC §2.6.3 RATIO_PROMPT 映射表（一字不差） */
export const RATIO_PROMPT: Record<RatioId, string> = {
  "3:4": "vertical portrait format, 3:4 aspect ratio, 1024×1366",
  "4:5": "vertical portrait format, 4:5 aspect ratio, 1024×1280",
  "1:1": "square format, 1:1 aspect ratio, 1024×1024",
  "9:16": "tall vertical format, 9:16 aspect ratio, full-screen mobile, 1024×1820",
  "3:2": "horizontal landscape format, 3:2 aspect ratio, 1536×1024",
  "16:9": "wide horizontal format, 16:9 aspect ratio, presentation style, 1820×1024",
  "4:3": "classic horizontal, 4:3 aspect ratio, document slide, 1280×960",
};

/** SPEC §2.6.3 COVER_HOOK_PROMPTS 映射（一字不差） */
export const COVER_HOOK_PROMPTS: Record<CoverHookId, string> = {
  number_promise:
    "Headline emphasizes a numeric promise; render the number in oversized display weight, 2-3x larger than other words",
  curiosity_gap:
    'Headline creates a curiosity gap; the percentage or "you don\'t know" phrase rendered in accent color',
  pain_relief:
    "Headline expresses pain relief; the pain word rendered in muted/struck-through style, the relief word in bright accent",
  contrarian:
    'Headline shows a contrarian twist; the "别再" or "其实" word rendered with visual emphasis (underline, highlight, or color shift)',
  identity_call:
    "Headline calls out an identity group; the identity tag rendered as a badge or pill at the top of the title",
  authority_quote:
    "Headline borrows authority; the authority figure (学霸/专家) rendered with subtle decoration",
  urgent_save:
    'Headline urges saving; "建议收藏" rendered as a stamp/badge accent',
  before_after:
    'Headline shows transformation; "从X到Y" rendered with arrow or progression visual between the two states',
};

/** SPEC §2.5.5 字号差距等级 → gpt-image-2 prompt 表述 */
const FONT_SCALE_PROMPT: Record<
  ReturnType<typeof getEmphasisLimits>["fontSizeContrast"],
  string
> = {
  extreme: "extreme (3:1)",
  medium: "moderate (2:1)",
  small: "subtle (1.4:1)",
};

// ─────────────────────── 拼装主入口 ───────────────────────

/**
 * SPEC §2.6.3 — assembleCardPrompt：
 *   ① styleBlock      ← style.promptBase 5 段
 *   ② layoutBlock     ← getCompositionLayout(card.composition)
 *   ③ contentBlock    ← 反引号锁定 title / subtitle / key_text + emphasis 指令
 *   ④ viralBlock      ← cover_hook（content_trigger 已融在 key_text 里）
 *   ⑤ techBlock       ← 语言 + 比例 + 序号 + anchor + templateAddon
 */
export function assembleCardPrompt(input: AssemblyInput): string {
  const {
    card,
    style,
    ratio,
    totalCount,
    anchorImageUrl,
    templateAddon,
  } = input;

  const styleBlock = buildStyleBlock(style);
  const layoutBlock = `Layout: ${getCompositionLayout(card.composition)}`;
  const contentBlock = buildContentBlock(card, style);
  const viralBlock = buildViralBlock(card);
  const techBlock = buildTechBlock({
    ratio,
    cardIndex: card.index,
    totalCount,
    anchorImageUrl,
    templateAddon,
  });

  return [styleBlock, "", layoutBlock, "", contentBlock, "", viralBlock, "", techBlock]
    .filter((s) => s !== null && s !== undefined && s !== "")
    .join("\n");
}

// ─────────────────────── 子段构造 ───────────────────────

function buildStyleBlock(style: CardStyle): string {
  const p = style.promptBase;
  return [
    `Style: ${p.styleAdjectives}`,
    `Colors: ${p.colorPalette}`,
    `Composition: ${p.composition}`,
    `Texture: ${p.texture}`,
    `Avoid: ${p.negativeCues}`,
  ].join("\n");
}

function buildContentBlock(card: AnalyzeCard, style: CardStyle): string {
  const lines: string[] = [];

  lines.push("Title text (rendered exactly as-is, in backticks):");
  lines.push(`  \`${card.title}\``);

  if (card.subtitle && card.subtitle.trim()) {
    lines.push("Subtitle:");
    lines.push(`  \`${card.subtitle}\``);
  }

  lines.push("Body content (rendered as multi-line text):");
  lines.push(`  \`${card.key_text}\``);

  // emphasis 指令
  const primaries = card.emphasis_words.filter((w) => w.weight === "primary");
  const secondaries = card.emphasis_words.filter((w) => w.weight === "secondary");

  if (primaries.length > 0 || secondaries.length > 0) {
    lines.push("");
    lines.push("Emphasis instructions:");
    for (const w of primaries) {
      lines.push(`  - "${w.text}": extra large bold, accent color`);
    }
    for (const w of secondaries) {
      lines.push(`  - "${w.text}": medium semi-bold, body color`);
    }
  }

  const limits = getEmphasisLimits(style.viralIntensity);
  lines.push(`Font scale ratio: ${FONT_SCALE_PROMPT[limits.fontSizeContrast]}`);

  return lines.join("\n");
}

function buildViralBlock(card: AnalyzeCard): string {
  // 仅 cover 用 cover_hook，正文 / 收尾的 content_trigger 已融在 key_text 里
  if (card.role === "cover" && card.cover_hook) {
    return `Cover hook style: ${COVER_HOOK_PROMPTS[card.cover_hook]}`;
  }
  return "";
}

function buildTechBlock(args: {
  ratio: RatioId;
  cardIndex: number;
  totalCount: number;
  anchorImageUrl?: string;
  templateAddon?: string;
}): string {
  const lines: string[] = [
    "Language: All text in Simplified Chinese only. Characters must render clearly without distortion.",
    "NEVER substitute, omit, or invent text outside what's in backticks.",
    `Aspect ratio: ${RATIO_PROMPT[args.ratio]}`,
    `Index marker: top-right corner, small text "${args.cardIndex}/${args.totalCount}"`,
  ];
  if (args.anchorImageUrl) {
    lines.push(`Reference image (style anchor): ${args.anchorImageUrl}`);
  }
  if (args.templateAddon && args.templateAddon.trim()) {
    lines.push(args.templateAddon.trim());
  }
  return lines.join("\n");
}
