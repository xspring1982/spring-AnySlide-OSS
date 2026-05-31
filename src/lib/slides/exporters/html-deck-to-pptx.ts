// 把现有 L1 deck.html 转成 PPTX(截图嵌入方式)
//
// 跟 blueprint-to-pptx.ts 的对比:
//   - blueprint-to-pptx: 输入 Blueprint JSON → 真 native OOXML(可编辑)
//   - html-deck-to-pptx (本): 输入完整 deck.html → playwright 截图 → 嵌入 PPTX(图片版,不可编辑)
//
// 为什么需要本文件:
//   - 现有从 0 生成的 L1 deck 没有 blueprint(直接是 LLM 输出的 HTML 字符串)
//   - 不重构 fillL1Template 也想给这些 deck 加 PPTX 下载能力
//   - 走截图嵌方案:视觉 100% 还原模板设计,Gamma 一个水平
//   - 用户拿到 PPT 后只能演讲不能编辑(可编辑版要等 Phase 2 续:每模板专属 pptxgenjs)
//
// 实现思路:
//   1. cheerio 解析 deck.html → 列所有 <section> 元素
//   2. 对每个 section 构造单页 HTML(保留 <head> CSS + body 里只放该 section)
//   3. playwright headless 渲染该单页 → 截图 1920×1080 PNG
//   4. pptxgenjs 把每张 PNG 嵌入 PPTX 的 slide 背景
//   5. 输出 .pptx Buffer

import { chromium } from "playwright";
import * as cheerio from "cheerio";
import PptxGenJS from "pptxgenjs";

const SLIDE_W = 13.33; // 英寸 (16:9)
const SLIDE_H = 7.5;
const VIEWPORT_W = 1920;
const VIEWPORT_H = 1080;

/**
 * 主入口:HTML deck → PPTX Buffer
 *
 * @param deckHtml 完整 deck HTML 字符串(含 <html><head> 和所有 <section>)
 * @param title 文档标题(写到 PPTX metadata)
 * @returns .pptx 二进制 Buffer
 */
export async function htmlDeckToPptx(
  deckHtml: string,
  title?: string,
): Promise<Buffer> {
  // 1. 拆 section
  const $ = cheerio.load(deckHtml);
  const sections = $("section").toArray();
  if (sections.length === 0) {
    throw new Error("deck.html 里没找到 <section> 元素");
  }

  // 2. 抽 <head> 内容(保留所有 CSS / font / meta)
  const headHtml = $("head").html() ?? "";

  // 3. 启动 playwright 一次,逐 section 截图
  const browser = await chromium.launch({ headless: true });
  const screenshots: Buffer[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
      deviceScaleFactor: 1,
    });

    for (const sec of sections) {
      const sectionHtml = $.html(sec) ?? "";
      // 构造单页 HTML:head 完全保留 + body 只放该 section,
      // 用 absolute fit 撑满 viewport(模板自己的 CSS 通常会有 100vh,这里加 fallback)
      const pageHtml = [
        "<!DOCTYPE html>",
        '<html lang="zh-CN">',
        "<head>",
        headHtml,
        "<style>",
        "  html, body { margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden; }",
        "  body > section { width: 1920px; height: 1080px; }",
        "</style>",
        "</head>",
        "<body>",
        sectionHtml,
        "</body>",
        "</html>",
      ].join("\n");

      await page.setContent(pageHtml, { waitUntil: "networkidle" });
      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: VIEWPORT_W, height: VIEWPORT_H },
      });
      screenshots.push(png);
    }
  } finally {
    await browser.close();
  }

  // 4. pptxgenjs 把截图嵌入
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5
  if (title) pres.title = title;
  pres.author = "AnySlide";
  pres.company = "AnySlide";

  for (const png of screenshots) {
    const slide = pres.addSlide();
    // 整页背景图(图片版,不可编辑)
    slide.addImage({
      data: `data:image/png;base64,${png.toString("base64")}`,
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
    });
  }

  const out = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

/**
 * HTML deck → PDF Buffer(直接 playwright print,不走截图嵌)
 *
 * 比 PPTX 简单 — playwright 自带 page.pdf() 能把渲染好的 HTML 转 PDF。
 * 视觉 100% 还原浏览器渲染。
 */
export async function htmlDeckToPdf(deckHtml: string): Promise<Buffer> {
  // 拆 section + 拼成连续多页 HTML(每个 section 用 @page page-break-after)
  const $ = cheerio.load(deckHtml);
  const sections = $("section").toArray();
  if (sections.length === 0) {
    throw new Error("deck.html 里没找到 <section> 元素");
  }

  const headHtml = $("head").html() ?? "";
  const sectionsHtml = sections.map((s) => $.html(s) ?? "").join("\n");

  // 加 @page 16:9 + section 强制分页
  const printCss = `
<style>
  @page { size: 13.33in 7.5in; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body > section { width: 1920px; height: 1080px; page-break-after: always; overflow: hidden; }
  body > section:last-child { page-break-after: auto; }
</style>`;

  const finalHtml = [
    "<!DOCTYPE html>",
    '<html lang="zh-CN">',
    "<head>",
    headHtml,
    printCss,
    "</head>",
    "<body>",
    sectionsHtml,
    "</body>",
    "</html>",
  ].join("\n");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
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
