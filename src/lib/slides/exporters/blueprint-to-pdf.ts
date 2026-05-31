// Phase 2 PR35:Blueprint → PDF exporter(用 playwright headless 截图 + 拼合)
//
// 设计思路:
//   - 跟 PPTX exporter(blueprint-to-pptx.ts)走不同路径
//   - PDF 是"打印纸"格式,本质就是冻结视觉
//   - 最稳的做法:用 blueprint 渲染 HTML(复用 renderer)→ playwright print to PDF
//   - 这样视觉跟 HTML 100% 一致(因为是浏览器渲染),用户拿到 PDF 看到的就是网页效果
//
// 跟 PPTX exporter 的对比:
//   PPTX:LLM blueprint → pptxgenjs 直接写 OOXML → 用户可在 PowerPoint 里改文字
//   PDF: LLM blueprint → 渲染 HTML → playwright print → 用户拿到不可改的 PDF
//
// 用户场景:
//   - 要可编辑 → 下载 PPTX
//   - 要分享 / 邮件 / 打印 / 投影 → 下载 PDF(视觉最稳)
//   - 要在线协作编辑 → 用网页版

import { chromium } from "playwright";
import * as cheerio from "cheerio";
import * as fs from "node:fs";
import * as path from "node:path";
import type { DeckBlueprint } from "../blueprint/schema";
import { renderBlueprintSection } from "../blueprint/renderer";

/**
 * 用 blueprint 渲染整份 deck HTML(用现有 renderer 复用),然后 playwright 打印 PDF。
 *
 * 工作流:
 *   1. 读 demo-template.html(或后续传入的具体模板 HTML)
 *   2. 按 section 拆,每个 section 用 renderBlueprintSection 严格填值
 *   3. 拼合成完整 HTML(@page 16:9 landscape, 每 section 强制分页)
 *   4. playwright launch chromium headless → page.setContent → page.pdf()
 *   5. 返回 Buffer
 *
 * @param deck blueprint
 * @param templatePath 模板 HTML 绝对路径(默认用 Phase 1 的 demo-template)
 * @returns PDF Buffer
 */
export async function blueprintToPdf(
  deck: DeckBlueprint,
  templatePath?: string,
): Promise<Buffer> {
  const tplPath =
    templatePath ??
    path.resolve(
      process.cwd(),
      "src/lib/slides/blueprint/demo-template.html",
    );
  const templateHtml = fs.readFileSync(tplPath, "utf-8");

  // 按 section 拆 + 用 blueprint 填值
  const $ = cheerio.load(templateHtml);
  const sectionsHtml: string[] = [];
  $("section").each((i, el) => {
    const sectionHtml = $.html(el) ?? "";
    const bp = deck.slides.find((b) => b.template_section_index === i + 1);
    if (!bp) {
      sectionsHtml.push(sectionHtml);
      return;
    }
    const result = renderBlueprintSection(sectionHtml, bp);
    // 提取 body 内容(剥掉 cheerio 自动包的 <html><body>)
    const $section = cheerio.load(result.html);
    sectionsHtml.push($section("section").first().toString() || result.html);
  });

  // 拼合完整 HTML(头部 + body)
  const headEnd = templateHtml.indexOf("</head>");
  const finalHtml = [
    templateHtml.slice(0, headEnd + 7),
    "<body>",
    sectionsHtml.join("\n"),
    "</body></html>",
  ].join("\n");

  // playwright 出 PDF
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    await page.setContent(finalHtml, { waitUntil: "networkidle" });
    const pdfBuf = await page.pdf({
      width: "13.33in",
      height: "7.5in",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return pdfBuf;
  } finally {
    await browser.close();
  }
}
