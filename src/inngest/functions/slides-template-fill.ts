// Phase2 T2-30/T2-33 — Slides 模板填充模式
//
// L1(HTML 模板填充):
//   1. 加载 template_html(完整 HTML deck,带 demo 内容)
//   2. Claude 收到 [模板原文 + 用户主题] → 输出"完整 HTML,demo 内容已替换为用户主题"
//   3. 落 1 个 task_file row(page_no=1, role='deck', storage_url=data URL HTML)
//
// L2(锁 baoyu 风格):
//   1. 加载 baoyu 风格 spec(.md 完整指令)
//   2. 每张 slide 的 image prompt 前置注入 spec
//   3. 仍走 anchor chain 逐张 gpt-image-2 出图

import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { ai } from "@/lib/ai";
import { appendTaskFile } from "@/lib/tasks/repo";
import type { Locale } from "@/i18n/routing";
import {
  LOCALE_NATIVE_NAME,
  LOCALE_FONT_STACK,
  LOCALE_TYPOGRAPHY_RULES,
} from "@/i18n/locale-util";

interface TemplateRow {
  id: string;
  mode: string;
  template_path: string | null;
  template_html: string | null;
  custom_prompt_addon: string | null;
  baoyu_style_id: string | null;
  style_id: string | null;
  name: string;
}

/**
 * guizang 主题色覆盖(同一份 HTML,通过追加 prompt 让 LLM 调主题)
 * monocle = 默认黑底暖白(留空 = 不改)
 * kraft   = 牛皮纸暖色 / 棕字
 */
const GUIZANG_THEME_OVERRIDES: Record<string, string> = {
  kraft: [
    "",
    "# 主题色覆盖(必须执行)",
    "这套模板默认是黑底白字。请把 `<style>` 里的主色调全部改成牛皮纸主题:",
    "- 背景色:#D4B896(牛皮纸黄棕)",
    "- 主文字:#3E2C1E(深棕)",
    "- 次文字:#7A5C3E(浅棕)",
    "- 强调色:#C45F2E(铁锈红)",
    "- 卡片背景:#F0E2C5(浅奶油)",
    "全文搜索原色值,精确替换。WebGL / canvas 颜色也一起换暖色。",
  ].join("\n"),
};

/**
 * 加载模板完整数据(后端 LLM 用,不经 /api/templates)
 */
export async function loadTemplate(templateId: string): Promise<TemplateRow | null> {
  const rows = (await sql`
    SELECT id, mode, template_path, template_html,
           custom_prompt_addon, baoyu_style_id, style_id, name
    FROM templates
    WHERE id = ${templateId} AND owner_user_id IS NULL
    LIMIT 1
  `) as unknown as TemplateRow[];
  return rows[0] ?? null;
}

/**
 * L1 模板填充:Claude 把模板里的 demo 内容改写成用户主题相关
 * 不分页,整个 deck 一次性生成
 */
export async function fillL1Template(args: {
  taskId: string;
  template: TemplateRow;
  userContent: string;
  userIntent?: string;
  /** M9 多语言:任务的目标语言;不传则默认 zh(兼容旧 caller)*/
  locale?: Locale;
}): Promise<{ html: string; modelUsed: string }> {
  const { template, userContent, userIntent } = args;
  const locale: Locale = args.locale ?? "zh";
  const langName = LOCALE_NATIVE_NAME[locale];
  const fontStack = LOCALE_FONT_STACK[locale];
  if (!template.template_html) {
    throw new Error(`Template ${template.id} has no template_html`);
  }

  // guizang 主题色覆盖(monocle 默认 / kraft 改牛皮纸色)
  const themeOverride = template.style_id
    ? GUIZANG_THEME_OVERRIDES[template.style_id] ?? ""
    : "";

  const system = [
    "你是 AnySlide 的 HTML 幻灯片改写助手。",
    "",
    "# 任务",
    "用户给你一份完整 HTML 幻灯片模板(已经精心设计好了视觉/排版/CSS),",
    "和一个新主题。你的工作是 **把模板里的 demo 文字内容,全部替换为关于新主题的内容**。",
    "",
    `# 输出语言(必须严格遵守)`,
    `所有可见文字(标题、副标、列表、引用、按钮文案、页码标签、注释 etc.)**必须**用 **${langName}** 输出。`,
    `如果模板原始 demo 文字是其他语言(例如英文模板有 "Slide" / "Next" / "Page 1 of 8" 字样),也要全部翻译成 ${langName}。`,
    `<html lang="..."> 属性也要改为 "${locale}"。`,
    `字体栈(必须替换 <style> 中原有的 font-family 为以下,确保 ${langName} 字符正确渲染):`,
    `  - 标题:${fontStack.heading}`,
    `  - 正文:${fontStack.body}`,
    `如果原模板用了 Google Fonts <link> 加载非 ${langName} 字体,**保留 link 但额外追加** Noto Sans 对应语言版的引用,并在 font-family 里把对应语言的字体放在最前。`,
    "",
    "# 严格要求(任一违反 = 视为失败)",
    "1. **CSS 类名 / DOM 结构 / 视觉装饰 / WebGL / 翻页器 JS 代码完全不动**,只改文字内容 + 字体栈(及上面 # 主题色覆盖 节)",
    "2. **绝对禁止改 font-size / line-height / padding / margin / max-width / width / height 等所有尺寸 CSS**",
    "   - ❌ 错误:demo 是 80px 标题,你改成 120px,因为内容文字更长 → 必然溢出 slide 容器",
    "   - ❌ 错误:demo 字号合适,你给加了 max-width: 200px 想让标题换行 → 改了原模板布局",
    "   - ✅ 正确:demo 文字是 80px 4 字短标题,你的内容也必须是 80px 短标题(精简文字到 4-6 字)",
    "3. **内容长度必须严格匹配 demo 文字长度**(±20% 字符数以内):",
    "   - 若原 demo 标题 5 字,你的标题不能超过 7 字;若原 demo 段落 80 字,你的段落 60-100 字之间",
    "   - 用户主题文字过长时,**精简文字**(取核心),不要改字号 / 容器尺寸",
    "4. **每张 .slide / section 必须保留**:原模板有 N 张 slide,改写后仍然是 N 张,不增不减不合并",
    "5. **每张 .slide div 都要改**,内容跟新主题相关(从该 slide 的 demo 文字推断该位置应放什么类型的内容)",
    "6. **如果模板有 hero/cover 页 → 用主题作大字标题** + 简短副标",
    "7. **如果模板有 agenda/目录页 → 列出主题下的 N 个分点**(根据 demo 文字数量决定 N)",
    "8. **如果模板有 content 页 → 改成主题对应章节的实际内容**(数据/案例/观点)",
    "9. 标题改写要有冲击力,正文要有信息密度,不要空话套话",
    "10. 输出**完整 HTML 文档**(包括 `<!DOCTYPE>` `<html>` `<head>` `<body>` `<script>`),不要 markdown 围栏",
    "11. 保留所有 `<script>` 原样不动(翻页器 / 动画逻辑)",
    "12. 严禁删除原模板任何核心 CSS(可在 <style> 末尾追加 font-family override,但不要删 / 改原 CSS)",
    "13. **核心心法**:你是「文字翻译 + 主题适配」工具,不是「视觉设计师」。原模板设计师精心调过每个尺寸,你只动 innerText / inner HTML,绝不动样式。",
    "",
    LOCALE_TYPOGRAPHY_RULES[locale],
    themeOverride, // 部分模板需要换主题色
    "",
    "# 输出格式",
    "直接输出完整 HTML,不要解释,不要 ```html 围栏,可以直接 srcdoc 注入 iframe 渲染。",
  ].filter(Boolean).join("\n");

  const user = [
    `# 用户主题(主标)`,
    userContent,
    "",
    userIntent ? `# 用户附加意图(可选)\n${userIntent}\n` : "",
    `# HTML 模板原文(请改写其内容并把所有文字翻译为 ${langName},保持 CSS 类名/JS 代码不动,字体栈按上面要求替换)`,
    "```html",
    template.template_html,
    "```",
  ].filter(Boolean).join("\n");

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 16000,
    // 2026-05-09 PR11:把模板视觉改坏的根因之一是 temperature 偏高让 LLM 自由「创意」。
    // 模板填充任务本质是文字替换(不是创作),要求 LLM 严格遵守原 CSS,降到 0.2 更保守。
    temperature: 0.2,
    cacheSystem: false, // 模板不固定,不缓存
  });

  // 剥 markdown 围栏(LLM 偶尔会包)
  let html = completion.text.trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();

  if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
    throw new Error(`L1 模板填充输出不像 HTML(前 200:${html.slice(0, 200)})`);
  }

  return { html, modelUsed: completion.model };
}

/**
 * 把填充好的 deck HTML 存为 1 个 task_file
 * page_no=1, role='deck' 标记为完整 deck(SlideDeckView 据此用全屏 iframe 模式)
 */
export async function persistL1FilledDeck(args: {
  taskId: string;
  html: string;
  templateName: string;
}): Promise<void> {
  const { taskId, html, templateName } = args;
  const dataUrl = `data:text/html;base64,${Buffer.from(html, "utf-8").toString("base64")}`;
  await appendTaskFile({
    id: nanoid(12),
    taskId,
    type: "image",
    pageNo: 1,
    pageVersion: 1,
    role: "cover", // schema 限 cover/content/closing,'cover' 兼容
    filename: `${templateName.replace(/\s/g, "-")}-deck.html`,
    storageUrl: dataUrl,
    mimeType: "text/html",
  });
}

/**
 * L2 锁 baoyu 风格:返回 prefix 文本注入到每张 image prompt 前
 */
export function buildL2BaoyuPrefix(template: TemplateRow): string {
  if (template.template_path !== "l2_image" || !template.custom_prompt_addon) {
    return "";
  }
  return [
    "# Style Lock (强制遵循以下风格规范)",
    template.custom_prompt_addon,
    "",
    "# 当前 slide(在以上风格下生成):",
  ].join("\n");
}

// ─────────────────────── PR15b: outline-driven 拼装 + 单页修改 ───────────────────────

import * as cheerio from "cheerio";
import type { SlidesAnalyzeOutput, SlideEntry } from "@/lib/slides/agents/types";
import { mergeTextIntoOriginalSection } from "@/lib/slides/html/text-lock";

/**
 * 从模板 HTML 解析出"deck shell"(head + body wrapper + 各 section)
 * 用于按 outline 重新拼装 deck.html
 */
interface TemplateDeckShell {
  /** 完整 <head>...</head>(含 styles / fonts / scripts)*/
  headInnerHTML: string;
  /** body 起始 wrapper 的 HTML(直到第一个 section 之前的那段),例如 `<div class="deck">` */
  bodyOpening: string;
  /** body 末尾 wrapper(最后一个 section 之后到 </body>),例如 `</div>\n<script>...</script>` */
  bodyClosing: string;
  /** 各个 section 的 outerHTML 数组(按原始顺序)*/
  sections: string[];
  /** <html lang="..."> 整个 attributes */
  htmlAttrs: string;
}

function parseDeckShell(html: string): TemplateDeckShell | null {
  // 尝试用 cheerio 提 head + sections,bodyOpening/bodyClosing 用字符串切分(因为 cheerio
  // 重新序列化会改变格式 / lose 原始注释 / lose script 顺序)
  const $ = cheerio.load(html);
  const headInnerHTML = $("head").html() ?? "";
  const htmlEl = $("html").get(0);
  const htmlAttrs = htmlEl
    ? Object.entries(($(htmlEl).attr() as Record<string, string>) ?? {})
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ")
    : 'lang="zh"';

  // 找所有 section(同 annotate-template-outlines.ts 的 fallback chain)
  const candidates = [
    "section.slide",
    ".slide:not(.slides):not(.slide-deck):not(.slide-meta)",
    "[data-slide]",
    "section[data-screen-label]",
    "section.chapter, .chapter",
    "section[class*='s-cover'], section[class^='s-']",
  ];
  let sections: cheerio.Cheerio<import("domhandler").AnyNode> | null = null;
  for (const sel of candidates) {
    const found = $(sel);
    if (found.length >= 2) {
      sections = found;
      break;
    }
  }
  if (!sections || sections.length === 0) {
    // 兜底:body > section
    const top = $("body > section, body > main > section");
    if (top.length >= 2) sections = top;
  }
  if (!sections || sections.length === 0) return null;

  const sectionHtmls: string[] = [];
  sections.each((_, el) => {
    const o = $.html(el);
    if (o) sectionHtmls.push(o);
  });

  // bodyOpening / bodyClosing:用第一个/最后一个 section 在原 html 里的位置切分
  // 这样 wrapper / 装饰元素 / scripts 都保留原样
  const firstSection = sectionHtmls[0];
  const lastSection = sectionHtmls[sectionHtmls.length - 1];
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return null;
  const bodyContent = bodyMatch[1];
  // 找第一个 section 出现位置
  const firstIdx = bodyContent.indexOf(firstSection);
  const lastIdx = bodyContent.lastIndexOf(lastSection);
  if (firstIdx === -1 || lastIdx === -1) return null;
  const bodyOpening = bodyContent.slice(0, firstIdx);
  const bodyClosing = bodyContent.slice(lastIdx + lastSection.length);

  return {
    headInnerHTML,
    bodyOpening,
    bodyClosing,
    sections: sectionHtmls,
    htmlAttrs,
  };
}

/**
 * 按 outline 拼装最终 deck.html
 * - 遍历 outline 的每张 slide,找到对应 template_section_index 的原 section
 * - 调 LLM 改写 section 的文字内容(只改 inner text,保留 CSS/DOM)
 * - 拼成 head + bodyOpening + N 个 filled section + bodyClosing
 */
export async function buildDeckFromOutline(args: {
  template: TemplateRow;
  outline: SlidesAnalyzeOutput;
  locale: import("@/i18n/routing").Locale;
}): Promise<{ html: string; modelUsed: string }> {
  const { template, outline, locale } = args;
  if (!template.template_html) {
    throw new Error(`Template ${template.id} has no template_html`);
  }
  const shell = parseDeckShell(template.template_html);
  if (!shell) {
    throw new Error(`无法解析模板 ${template.id} 的 deck shell`);
  }

  // 拍平 outline 为 [SlideEntry]
  const flat: SlideEntry[] = [outline.outline.cover];
  if (outline.outline.agenda) flat.push(outline.outline.agenda);
  for (const s of outline.outline.sections) {
    if (s.divider) flat.push(s.divider);
    flat.push(...s.slides);
  }
  flat.push(outline.outline.closing);

  const langName = LOCALE_NATIVE_NAME[locale];
  const fontStack = LOCALE_FONT_STACK[locale];

  let modelUsed = "";
  const filledSections: string[] = [];

  // 逐个 section 调 LLM 填充
  for (const slide of flat) {
    const tplIdx = slide.template_section_index ?? 1;
    const originalSection = shell.sections[tplIdx - 1];
    if (!originalSection) {
      // 兜底用第一个
      filledSections.push(shell.sections[0] ?? "");
      continue;
    }
    const filled = await fillSingleSection({
      originalSection,
      slide,
      langName,
      fontStack,
      locale,
    });
    filledSections.push(filled.html);
    if (!modelUsed) modelUsed = filled.modelUsed;
  }

  // 拼装 — htmlAttrs 已含原始 lang,但用户切语言时要更新
  const updatedHtmlAttrs = shell.htmlAttrs.replace(
    /lang="[^"]*"/i,
    `lang="${locale}"`,
  ) || `lang="${locale}"`;

  const finalHtml = [
    "<!DOCTYPE html>",
    `<html ${updatedHtmlAttrs}>`,
    `<head>${shell.headInnerHTML}</head>`,
    "<body>",
    shell.bodyOpening,
    filledSections.join("\n"),
    shell.bodyClosing,
    "</body>",
    "</html>",
  ].join("\n");

  return { html: finalHtml, modelUsed: modelUsed || "claude-section-fill" };
}

/**
 * 调 LLM 把单个 section 的 demo 文字内容,改写为 slide entry(title/body/bullets 等)对应的内容
 * - CSS / 类名 / DOM 结构 完全不动
 * - 只 swap innerText
 */
async function fillSingleSection(args: {
  originalSection: string;
  slide: SlideEntry;
  langName: string;
  fontStack: { heading: string; body: string };
  locale: import("@/i18n/routing").Locale;
}): Promise<{ html: string; modelUsed: string }> {
  const { originalSection, slide, langName, fontStack, locale } = args;

  const slideContent = [
    `角色:${slide.role}`,
    `标题:${slide.title}`,
    slide.subtitle ? `副标:${slide.subtitle}` : "",
    slide.body ? `正文:${slide.body}` : "",
    slide.bullets && slide.bullets.length > 0
      ? `要点:\n${slide.bullets.map((b, i) => `  ${i + 1}. ${b}`).join("\n")}`
      : "",
    slide.callout ? `引用 / callout:${slide.callout}` : "",
    slide.visual_hint ? `视觉提示:${slide.visual_hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "你是 AnySlide 的 HTML section 改写助手。任务:把单个 <section class='slide'> 的 demo 文字,",
    "全部替换为指定 slide 内容。",
    "",
    `# 输出语言:**${langName}**`,
    `所有可见文字必须用 ${langName}。如果原 demo 是其他语言,全部翻译。`,
    `字体栈(若 section 内 inline 写了 font-family,把头部加上):heading=${fontStack.heading}; body=${fontStack.body}`,
    "",
    LOCALE_TYPOGRAPHY_RULES[locale],
    "",
    "# 严格要求(任一违反 = 视为失败)",
    "1. **CSS 类名 / DOM 结构 / inline style 完全不动**",
    "2. **绝对禁止改 font-size / line-height / padding / margin / max-width / width / height**",
    "3. **内容长度严格匹配 demo**(±20% 字符数);如果给的内容长,精简文字而不是改字号",
    "4. 只输出**修改后的单个 <section> 元素**(不带 head / body / 其他 section),可直接 innerHTML 注入",
    "5. 不要 markdown 围栏",
    "",
    "# 核心心法",
    "你只换 innerText / inner HTML 的文字,绝不动样式。原模板设计师精心调过尺寸。",
  ].join("\n");

  const user = [
    "# 模板 section 原文(改写其文字内容,保留所有 HTML 标签 / class / inline style)",
    "```html",
    originalSection,
    "```",
    "",
    "# 要塞入的 slide 内容",
    slideContent,
    "",
    "现在直接输出修改后的 <section>...</section>,不要任何解释 / markdown 围栏。",
  ].join("\n");

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 6000,
    temperature: 0.2,
    cacheSystem: false,
  });

  let html = completion.text.trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // 校验:开头必须有 < 标签(不一定是 <section,模板可能用 .chapter / .s1)
  if (!html.startsWith("<")) {
    throw new Error(`fillSingleSection 输出非 HTML(前 200:${html.slice(0, 200)})`);
  }

  return {
    html: mergeTextIntoOriginalSection(originalSection, html),
    modelUsed: completion.model,
  };
}

/**
 * PR15b:单页修改 — 用户描述要改成什么,LLM 重写指定 section
 *
 * 1. 从 deck.html 解析出第 N 个 section
 * 2. LLM 重写(基于 instruction + 原 section)
 * 3. 替换原 deck.html 里的对应 section,返回新 deck.html
 */
export async function refineL1Section(args: {
  deckHtml: string;
  pageNo: number;
  instruction: string;
  locale: import("@/i18n/routing").Locale;
}): Promise<{ html: string; modelUsed: string }> {
  const { deckHtml, pageNo, instruction, locale } = args;
  const shell = parseDeckShell(deckHtml);
  if (!shell) throw new Error("无法解析 deck.html shell");
  if (pageNo < 1 || pageNo > shell.sections.length) {
    throw new Error(
      `pageNo ${pageNo} 越界(共 ${shell.sections.length} 张)`,
    );
  }

  const original = shell.sections[pageNo - 1];
  const langName = LOCALE_NATIVE_NAME[locale];
  const fontStack = LOCALE_FONT_STACK[locale];

  const system = [
    "你是 AnySlide 的 HTML section 改写助手。任务:基于用户的修改要求,改写指定 slide section。",
    "",
    `# 输出语言:**${langName}**`,
    `字体栈:heading=${fontStack.heading}; body=${fontStack.body}`,
    "",
    LOCALE_TYPOGRAPHY_RULES[locale],
    "",
    "# 严格要求",
    "1. CSS / 类名 / DOM 结构 / inline style 完全不动,只改文字内容",
    "2. 绝对禁止改 font-size / 尺寸 CSS",
    "3. 内容长度严格匹配原 section 字数(±20%)",
    "4. 只输出修改后的单个 <section> 元素",
    "5. 不要 markdown 围栏 / 解释",
    "",
    "# 核心心法",
    "原 section 的视觉布局是设计师调好的,你只换文字。",
  ].join("\n");

  const user = [
    "# 当前 section 原文",
    "```html",
    original,
    "```",
    "",
    "# 用户修改要求",
    instruction,
    "",
    "现在直接输出修改后的 section,不要任何解释。",
  ].join("\n");

  const completion = await ai.text.complete({
    system,
    user,
    tier: "default",
    maxTokens: 6000,
    temperature: 0.2,
    cacheSystem: false,
  });

  let newSection = completion.text.trim();
  newSection = newSection
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!newSection.startsWith("<")) {
    throw new Error(`refineL1Section 输出非 HTML(前 200:${newSection.slice(0, 200)})`);
  }
  newSection = mergeTextIntoOriginalSection(original, newSection);

  // 替换 deckHtml 里第 N 个 section
  const updatedHtmlAttrs = shell.htmlAttrs.replace(
    /lang="[^"]*"/i,
    `lang="${locale}"`,
  ) || `lang="${locale}"`;

  const newSections = [...shell.sections];
  newSections[pageNo - 1] = newSection;
  const finalHtml = [
    "<!DOCTYPE html>",
    `<html ${updatedHtmlAttrs}>`,
    `<head>${shell.headInnerHTML}</head>`,
    "<body>",
    shell.bodyOpening,
    newSections.join("\n"),
    shell.bodyClosing,
    "</body>",
    "</html>",
  ].join("\n");

  return { html: finalHtml, modelUsed: completion.model };
}
