// scripts/annotate-template-outlines.ts
// PR15a:扫描 32 个外部模板的 .html,用 cheerio + 启发式规则解析每个 .slide section,
// 推断 role(cover / agenda / content / quote / stat / closing)+ 提取标题预览,
// 写入 templates.template_outline JSONB。
//
// 用法:
//   npx tsx --env-file=.env.local scripts/annotate-template-outlines.ts
//
// 启发式规则(覆盖 80% case,剩余可后续手工修正):
//   - 第 1 张 + 含大字标题 → cover
//   - 最后 1 张 + 含 thank/contact/end 关键词 → closing
//   - 含 agenda / table-of-contents / contents 关键词 → agenda
//   - 含 <blockquote> / .quote / 引号 → content_quote
//   - 多个 .stat / .number / 大字数字 → stat_grid
//   - grid / 多列布局(.row / .col / .columns) → content_columns
//   - 否则 → content
//
// 输出 JSONB:
//   [
//     { index: 1, role: "cover", title: "...", preview: "前 80 字 textContent" },
//     ...
//   ]

import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
// cheerio 1.x 不再 re-export Element/AnyNode,要从 domhandler 直接 import
import type { AnyNode } from "domhandler";

type Sec = cheerio.Cheerio<AnyNode>;

const TEMPLATES_DIR = path.resolve(
  process.cwd(),
  "src/lib/slides/templates/external",
);

interface SectionOutline {
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

function inferRole(
  $section: Sec,
  index: number,
  totalSections: number,
  $: cheerio.CheerioAPI,
): SectionOutline["role"] {
  const className = ($section.attr("class") ?? "").toLowerCase();
  const text = ($section.text() ?? "").toLowerCase();
  const isFirst = index === 1;
  const isLast = index === totalSections;

  // 1. cover:第一张 + 类名含 cover/title/hero 或类型 keywords
  if (
    isFirst &&
    /cover|title|hero|opener|s1\b|first|intro/.test(className)
  ) {
    return "cover";
  }
  if (isFirst) return "cover"; // 第一张兜底为 cover

  // 2. closing:最后一张 + 含 thanks/end/q&a/contact 或类名提示
  if (isLast || /closing|end|thanks|outro|cta|contact/.test(className)) {
    if (
      /thank|谢谢|ありがと|감사|q\s*&\s*a|联系|contact|邮箱|email|website|致谢|了|完|end|总结|summary/.test(
        text.slice(0, 600),
      )
    ) {
      return "closing";
    }
  }
  if (isLast) return "closing"; // 最后一张兜底

  // 3. agenda:类名 / 文字含 agenda / contents / 目录
  if (
    /agenda|toc|table-of-contents|contents|目录|内容|大綱|大纲|目次|차례/.test(
      className,
    ) ||
    /agenda|table of contents|目录|目次|차례|大纲|大綱/.test(text.slice(0, 200))
  ) {
    return "agenda";
  }

  // 4. content_quote:含 blockquote 或 .quote 类 + 短文字
  if (
    $section.find("blockquote").length > 0 ||
    $section.find(".quote, .pullquote, .pull-quote, .epigraph, .blockquote")
      .length > 0
  ) {
    return "content_quote";
  }

  // 5. stat_grid:含 ≥3 个 .stat / .number / .metric 元素
  const statCount = $section.find(
    ".stat, .number, .metric, .kpi, .data-point, .statistic, .figure",
  ).length;
  if (statCount >= 3) return "stat_grid";

  // 6. content_columns:多列 grid 布局(.row+.col, .columns, .grid 多 child)
  const hasMultiCol =
    $section.find(".row .col, .columns .column, .col-2, .col-3, .grid > *").length >=
      2 ||
    /grid-template-columns|flex.*row/.test(
      $section.attr("style") ?? "",
    );
  if (hasMultiCol) return "content_columns";

  return "content";
}

function cleanText(raw: string): string {
  // 去多余空白(连续空格/换行/tab → 单空格),trim
  return raw.replace(/\s+/g, " ").trim();
}

function extractTitle(
  $section: Sec,
  fallback: string,
): string {
  // 优先按权重找标题:h1 > h2 > h3 > .title/.headline > 第 1 行
  const candidates = [
    "h1",
    "h2",
    "h3",
    ".title",
    ".headline",
    ".h-hero",
    ".h-xl",
    ".h-md",
    ".hero-title",
    ".section-title",
    ".big-title",
    ".display",
    "[data-title]",
  ];
  for (const sel of candidates) {
    const el = $section.find(sel).first();
    const txt = cleanText(el.text() ?? "");
    // 真标题一般 < 40 字,长 quote / paragraph 不算 title
    if (txt && txt.length > 0 && txt.length <= 40) {
      return txt;
    }
  }
  // fallback:第一行非空 textContent(短句)
  const lines = ($section.text() ?? "")
    .split("\n")
    .map((l) => cleanText(l))
    .filter((l) => l.length > 0 && l.length <= 40);
  return lines[0] ?? cleanText(fallback);
}

function extractPreview(
  $section: Sec,
  excludeTitle: string,
): string {
  // 取 textContent 截 80 字,去掉跟 title 重复的开头部分
  const full = cleanText($section.text() ?? "");
  let body = full;
  const cleanTitle = cleanText(excludeTitle);
  if (cleanTitle && full.includes(cleanTitle)) {
    body = full.replace(cleanTitle, "").trim();
  }
  return body.slice(0, 80);
}

function findSections(html: string, $: cheerio.CheerioAPI) {
  // 优先级递降的 selector chain — 不同模板用不同 class 命名 slide section
  const candidates: string[] = [
    "section.slide",
    ".slide:not(.slides):not(.slide-deck):not(.slide-meta)",
    "[data-slide]",
    "section[data-screen-label]", // peoples-platform: <section class="s-cover" data-screen-label="01 Cover">
    "section.chapter, .chapter", // editorial-tri-tone
    "section[class*='s-cover'], section[class^='s-']", // peoples-platform 的 s-cover/s-toc/s-manifesto/...
  ];
  for (const sel of candidates) {
    const found = $(sel);
    if (found.length >= 2) return found;
  }
  // 最后兜底:body > section 顶层
  const top = $("body > section, body > main > section");
  if (top.length >= 2) return top;
  // 再兜底:类名匹配 s\d+(creative-mode 的 .s1 .s2 ...,排除 .slide-meta 之类)
  const fallback = $("body *").filter((_, el) => {
    const cls = $(el).attr("class") ?? "";
    if (!/\bs\d+\b/.test(cls)) return false;
    if (/(meta|label|hint|footer|header|nav|button|btn|icon|deco)/i.test(cls)) return false;
    return true;
  });
  return fallback;
}

export function annotate(html: string): SectionOutline[] {
  const $ = cheerio.load(html);
  const sections = findSections(html, $);

  const out: SectionOutline[] = [];
  const total = sections.length;
  sections.each((i, el) => {
    const $sec = $(el);
    const index = i + 1;
    const role = inferRole($sec, index, total, $);
    const title = extractTitle($sec, `第 ${index} 页`);
    const preview = extractPreview($sec, title);
    out.push({ index, role, title, preview });
  });
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  const slugs = readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""));

  console.log(`扫描 ${slugs.length} 个外部模板...\n`);

  let updated = 0;
  let skipped = 0;
  const summary: Array<{
    slug: string;
    sections: number;
    roles: Record<string, number>;
  }> = [];

  for (const slug of slugs) {
    const htmlPath = path.join(TEMPLATES_DIR, `${slug}.html`);
    const html = readFileSync(htmlPath, "utf-8");
    const outline = annotate(html);

    if (outline.length === 0) {
      console.warn(`  ⚠ ${slug}: 0 sections,跳过`);
      skipped += 1;
      continue;
    }

    // 写 DB(template_outline 字段已在 m7 migration 加好)
    const id = `ext-${slug}`;
    const result = (await sql`
      UPDATE templates SET
        template_outline = ${JSON.stringify(outline)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id} AND owner_user_id IS NULL
      RETURNING id
    `) as Array<{ id: string }>;

    if (result.length === 0) {
      console.warn(`  ⚠ ${slug}: 模板 id 不存在,跳过`);
      skipped += 1;
      continue;
    }

    const roles: Record<string, number> = {};
    for (const s of outline) {
      roles[s.role] = (roles[s.role] ?? 0) + 1;
    }
    const rolesSummary = Object.entries(roles)
      .map(([r, n]) => `${r}:${n}`)
      .join(" ");
    console.log(`  ✓ ${slug.padEnd(22)} ${outline.length} sections — ${rolesSummary}`);
    summary.push({ slug, sections: outline.length, roles });
    updated += 1;
  }

  console.log(
    `\n✅ 完成 — 更新 ${updated} / 跳过 ${skipped} / 总 ${slugs.length}`,
  );

  // 角色分布总览
  const allRoles: Record<string, number> = {};
  let totalSections = 0;
  for (const s of summary) {
    totalSections += s.sections;
    for (const [r, n] of Object.entries(s.roles)) {
      allRoles[r] = (allRoles[r] ?? 0) + n;
    }
  }
  console.log(`\n=== 角色分布(共 ${totalSections} sections)===`);
  for (const [r, n] of Object.entries(allRoles).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r.padEnd(18)} ${n} (${((n / totalSections) * 100).toFixed(0)}%)`);
  }
}

// 仅在直接运行时执行(被其他脚本 import annotate 时不触发)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("❌ annotate 失败:", err);
    process.exit(1);
  });
}
