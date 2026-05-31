// SPEC §3.5.3 — Slides prompt-assembly(L1 + L2 双分支)
//
// **纯字符串模板**:
//   L1:输出"喂给 Claude 的 HTML 渲染器 prompt"(让 Claude 输出 HTML 片段)
//   L2:输出"喂给 gpt-image-2 的图像 prompt"(5 段拼装,与 cards 同模式)

import { getL1Layout, type L1Layout, type L1LayoutId } from "../layouts";
import { getL2Pattern, type L2VisualPattern, type L2PatternId } from "../visual-patterns";
import type { SlideStyle } from "../styles/types";
import type { GenerationPath, SlideEntry, SlideRatio } from "./types";
import type { Locale } from "@/i18n/routing";
import {
  LOCALE_NATIVE_NAME,
  LOCALE_FONT_STACK,
  LOCALE_TYPOGRAPHY_RULES,
} from "@/i18n/locale-util";

export interface SlidesAssemblyInput {
  slide: SlideEntry;
  style: SlideStyle;
  ratio: SlideRatio;
  generationPath: GenerationPath;
  /** L2 第 2 张起携带封面 URL 作 ref(Anchor Chain) */
  anchorImageUrl?: string;
  /** M9 多语言:任务的目标语言 */
  locale?: Locale;
}

export interface SlidesAssemblyOutput {
  /** L1 路径产物:喂给 Claude 文本生成,Claude 返 HTML 片段 */
  htmlPrompt?: { system: string; user: string };
  /** L2 路径产物:喂给 gpt-image-2 的图像 prompt */
  imagePrompt?: string;
  /** L2 第 2 张起的 ref URL */
  refUrl?: string;
}

const RATIO_PROMPT: Record<SlideRatio, string> = {
  "16:9": "wide horizontal format, 16:9 aspect ratio, presentation deck, 1820×1024",
  "9:16": "tall vertical format, 9:16 aspect ratio, mobile / 朋友圈, 1024×1820",
  "4:3": "classic horizontal, 4:3 aspect ratio, document slide, 1280×960",
  "1:1": "square format, 1:1 aspect ratio, social card, 1024×1024",
  "3:2": "horizontal landscape, 3:2 aspect ratio, 1536×1024",
};

/** 主入口 */
export function assembleSlidePrompt(input: SlidesAssemblyInput): SlidesAssemblyOutput {
  if (input.generationPath === "L1") {
    if (!input.slide.layout_id) {
      throw new Error("L1 slide 缺少 layout_id");
    }
    const layout = getL1Layout(input.slide.layout_id as L1LayoutId);
    return { htmlPrompt: assembleL1HtmlPrompt(input, layout) };
  } else {
    if (!input.slide.visual_pattern) {
      throw new Error("L2 slide 缺少 visual_pattern");
    }
    const pattern = getL2Pattern(input.slide.visual_pattern as L2PatternId);
    return {
      imagePrompt: assembleL2ImagePrompt(input, pattern),
      refUrl: input.anchorImageUrl,
    };
  }
}

// ─────────────────────── L1 分支 ───────────────────────

function assembleL1HtmlPrompt(
  input: SlidesAssemblyInput,
  layout: L1Layout,
): { system: string; user: string } {
  const { slide, style, ratio } = input;
  const locale: Locale = input.locale ?? "zh";
  const langName = LOCALE_NATIVE_NAME[locale];
  const fontStack = LOCALE_FONT_STACK[locale];

  const system = [
    "你是 AnySlide 的 HTML slide 渲染器。",
    "任务:根据当前 slide 的内容、风格、版式,输出一段严格符合 layout schema 的 HTML 片段。",
    "",
    `# 输出语言(强制)`,
    `所有 slide 文字必须用 **${langName}** 输出。content 字段中反引号锁定的内容已经是 ${langName},请原样使用,不要翻译。`,
    "",
    LOCALE_TYPOGRAPHY_RULES[locale],
    "",
    "# 输出约束",
    "- 输出**仅 HTML 片段**,无 markdown 围栏,无 ```html 标记,可直接 innerHTML 注入",
    `- 必须使用 layout.gridClass 作为根容器 class:${layout.gridClass}`,
    "- 必须使用风格预定义的 CSS 类(h-hero / h-xl / h-md / kicker / lead / callout)",
    "- 不允许 inline style(除非 layout 明确要求)",
    "- 不允许引入外部 <link> 或 <style>",
    "",
    "# ⚠️ 反垃圾内容硬约束(2026-05-05 Bug 6 修)",
    "- **禁止占位符**:不要出现 ?/?????/❓/Placeholder/Lorem ipsum/TBD/未知/待补充 等任何占位符号",
    "- **禁止空块**:visual / image / chart 槽位若没具体内容,用相关 emoji 或风格化文字 / 引用 / 数字大字报代替,**不要留空白色块或问号占位**",
    "- **禁止重复**:不要把 title 文字直接重复贴在 body / callout 里凑字数",
    "- **必须充满**:每个 layout slot 都必须有真实内容(从 user 内容提炼或合理引申),不要任何 slot 留空",
    "- **图片资源**:layout 要求 <img> 时,如果用户没提供图,**不要插 <img>**(浏览器会显示破图);改用 emoji block / icon font / SVG geometry / 大色块 + 大字 来填充该区域",
    "",
    "# 当前风格",
    `风格 ID:${style.id}(${style.name})`,
    `配色:primary=${style.colors.primary} / secondary=${style.colors.secondary} / accent=${style.colors.accent} / bg=${style.colors.bg} / text=${style.colors.text}`,
    `字体(${langName} 优化栈,heading 与 body 都用):heading=${fontStack.heading}, body=${fontStack.body}`,
    `字号 scale: h1=${style.scale.h1} / h2=${style.scale.h2} / body=${style.scale.body}`,
    `emojiPolicy:${style.emojiPolicy}`,
    "",
    "# 当前版式",
    `ID:${layout.id}(${layout.name})`,
    `gridClass:${layout.gridClass}`,
    `slotCount:${layout.slotCount}`,
    `内容字段约束:${JSON.stringify(layout.contentSlots)}`,
    `风格 CSS 实施要求:${layout.themeCssRequirements.join(" / ")}`,
    "",
    "# 比例",
    `- 容器 aspect-ratio:${ratio}`,
    "",
    "# 字段映射",
    `- title → <h1 class="${layout.contentSlots.title?.level ?? "h-xl"}">…</h1>`,
    "- subtitle → <p class=\"h-sub\">…</p>",
    '- bullets → <ul><li data-anim="line">…</li>…</ul>',
    "- body → <p class=\"lead\">…</p> 或多个 <p>",
    '- callout → <blockquote class="callout">…</blockquote>',
    "- statCards / steps / images / quote → 按 layout.contentSlots 的字段类型展开",
  ].join("\n");

  const lines: string[] = [
    "# 当前 slide 内容(必须严格使用,不允许重写或扩展)",
    "```",
    `title: \`${slide.title}\``,
  ];
  if (slide.subtitle) lines.push(`subtitle: \`${slide.subtitle}\``);
  if (slide.bullets && slide.bullets.length > 0) {
    lines.push(`bullets: ${JSON.stringify(slide.bullets)}`);
  }
  if (slide.body) lines.push(`body: \`${slide.body}\``);
  if (slide.callout) lines.push(`callout: \`${slide.callout}\``);
  if (slide.visual_hint) lines.push(`visual_hint: ${slide.visual_hint}`);
  lines.push("```", "", "请输出该 slide 的 HTML 片段(仅 HTML,不要任何文字 / markdown / 解释)。");

  return { system, user: lines.join("\n") };
}

// ─────────────────────── L2 分支(5 段拼装) ───────────────────────

function assembleL2ImagePrompt(
  input: SlidesAssemblyInput,
  pattern: L2VisualPattern,
): string {
  const { slide, style, ratio, anchorImageUrl } = input;
  const locale: Locale = input.locale ?? "zh";
  const base = style.l2PromptBase;
  if (!base) {
    throw new Error(`Style ${style.id} 没有 l2PromptBase,不能用 L2 路径`);
  }

  // M9 多语言:不同 locale 不同的"Language" 段(给 gpt-image-2 文字渲染指令)
  const languageDirective: Record<Locale, string> = {
    en:
      "Language: All text in English only (Latin script). Use clean modern sans-serif glyphs.",
    zh:
      "Language: All text in Simplified Chinese only (简体中文 / Hans). Characters must render clearly without distortion.",
    "zh-TW":
      "Language: All text in Traditional Chinese only (繁體中文 / Hant). Characters must render clearly without distortion.",
    ja:
      "Language: All text in Japanese only (日本語 — Hiragana / Katakana / Kanji mix). Characters must render clearly without distortion.",
    ko:
      "Language: All text in Korean only (한국어 / Hangul). Characters must render clearly without distortion.",
  };

  const segments: string[] = [
    // [1] 风格调性
    `Style: ${base.styleAdjectives}`,
    "",
    // [2] 配色
    `Colors: ${base.colorPalette}`,
    "",
    // [3] 构图
    `Composition: ${base.composition}`,
    "",
    // [4] visual pattern 骨架
    `Slide visual pattern — ${pattern.id}: ${pattern.visualHint}. ${pattern.scenario}.`,
    "",
    // [5] 内容(反引号锁定 + ratio + negative cues)
    "Content text on this slide (render exactly as written, do not paraphrase or translate):",
    `  Title: \`${slide.title}\``,
  ];
  if (slide.subtitle) segments.push(`  Subtitle: \`${slide.subtitle}\``);
  if (slide.bullets && slide.bullets.length > 0) {
    segments.push("  Bullet points:");
    for (const b of slide.bullets) segments.push(`    - \`${b}\``);
  }
  if (slide.body) segments.push(`  Body: \`${slide.body}\``);
  if (slide.callout) segments.push(`  Callout quote: \`${slide.callout}\``);
  if (slide.visual_hint) segments.push(`  Visual hint: ${slide.visual_hint}`);

  segments.push(
    "",
    languageDirective[locale],
    "NEVER substitute, omit, or invent text outside what's in backticks.",
    `Aspect ratio: ${RATIO_PROMPT[ratio]}`,
  );

  if (anchorImageUrl) {
    segments.push(`Reference image (style anchor): ${anchorImageUrl}`);
  }

  segments.push(`Avoid: ${base.negativeCues}`);

  return segments.join("\n");
}
