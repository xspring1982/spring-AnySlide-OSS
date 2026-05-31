// Phase 2 续 PR50:ext-blue-professional 模板的 pptxgenjs 专属实现
//
// 视觉来源:src/lib/slides/templates/external/blue-professional.html
// 配色:暖奶白 #FDFAE7 + 电蓝 #1E2BFA + 深字 #111111
// 字体:Space Grotesk(heading) + Inter(body) — pptxgenjs 会 fallback 到系统字
//
// Role 映射(blueprint role → 该模板的对应视觉):
//   cover            → SLIDE 1 hero(左对齐大标题 + 右侧多边形蓝色块装饰 + 3×3 dot grid)
//   agenda           → SLIDE 2 agenda 双栏 6 格(01-06 大数字 + 标题 + 描述)
//   content + big_number → SLIDE 3 metric card 风(单大数字 + label + caption)
//   content + bullets    → SLIDE 5 split 风(左 bullet 列表 + accent line)
//   section_divider  → 大字标题 + accent line(简化版)
//   closing          → SLIDE 10 closing(居中 Thank You + accent line + contact)

import type PptxGenJS from "pptxgenjs";
import type { SlideBlueprint } from "../../blueprint/schema";
import { getSlideLayoutIntent } from "../../blueprint/layout-intent";
import {
  SLIDE_W,
  SLIDE_H,
  strVal,
  listVal,
} from "./_shared";

/** ext-blue-professional 的 theme 常量 — 跟 HTML CSS variables 完全一致 */
export const BLUE_PRO_THEME = {
  bg: "FDFAE7",
  primary: "1E2BFA",
  text: "111111",
  textMuted: "6B6B6B",
  textLight: "9A9A9A",
  accentLightHex: "EEF0FE", // rgba(30,43,250,0.08) flatten 到不透明 ≈ #EEF0FE
  cardBgHex: "F7F8FE", // rgba(30,43,250,0.04) flatten ≈ #F7F8FE
  headingFont: "Space Grotesk",
  bodyFont: "Inter",
} as const;

/** 画 cover 的右侧多边形装饰 — pptxgenjs 不支持 clip-path,用 1 个 freeform 图形最接近 */
function drawCoverDecoration(slide: PptxGenJS.Slide): void {
  // 原 CSS:width 35vw + clip-path polygon(30% 0, 100% 0, 100% 100%, 0% 100%)
  // 简化为右侧梯形:左下角 4.67"(35vw 起点) → 顶 13.33" → 右下 13.33" → 左下 7.67"(收尾斜切)
  slide.addShape("rect", {
    x: SLIDE_W - 5.5,
    y: 0,
    w: 5.5,
    h: SLIDE_H,
    fill: { color: BLUE_PRO_THEME.accentLightHex },
    line: { color: BLUE_PRO_THEME.accentLightHex, width: 0 },
  });
}

/** 画 3×3 dot grid(右下角小装饰) */
function drawCoverDots(slide: PptxGenJS.Slide): void {
  const dotSize = 0.08;
  const gap = 0.16;
  const startX = SLIDE_W - 1.5;
  const startY = SLIDE_H - 1.6;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      slide.addShape("ellipse", {
        x: startX + j * gap,
        y: startY + i * gap,
        w: dotSize,
        h: dotSize,
        fill: { color: BLUE_PRO_THEME.primary, transparency: 75 },
        line: { color: BLUE_PRO_THEME.primary, width: 0, transparency: 75 },
      });
    }
  }
}

/** 60×4 px 主色 accent line(横条),用作分隔 */
function drawAccentLine(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w = 0.63 // 60px ≈ 0.63 in
): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h: 0.04,
    fill: { color: BLUE_PRO_THEME.primary },
    line: { color: BLUE_PRO_THEME.primary, width: 0 },
  });
}

/** 通用 slide-header:左上小标题 + 右上 chip-style tag */
function drawSlideHeader(
  slide: PptxGenJS.Slide,
  header: string,
  tag?: string
): void {
  slide.addText(header.toUpperCase(), {
    x: 0.6,
    y: 0.4,
    w: 8,
    h: 0.4,
    fontSize: 11,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.primary,
    charSpacing: 1,
  });
  if (tag) {
    // chip-style tag:圆角矩形 + accent-light bg + primary text
    slide.addShape("roundRect", {
      x: SLIDE_W - 2.2,
      y: 0.38,
      w: 1.6,
      h: 0.42,
      fill: { color: BLUE_PRO_THEME.accentLightHex },
      line: { color: BLUE_PRO_THEME.accentLightHex, width: 0 },
      rectRadius: 0.21,
    });
    slide.addText(tag, {
      x: SLIDE_W - 2.2,
      y: 0.38,
      w: 1.6,
      h: 0.42,
      fontSize: 10,
      fontFace: BLUE_PRO_THEME.headingFont,
      color: BLUE_PRO_THEME.primary,
      align: "center",
      valign: "middle",
    });
  }
}

/** Cover slide — SLIDE 1 hero 风 */
function renderCover(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  drawCoverDecoration(slide);
  drawCoverDots(slide);
  drawAccentLine(slide, 0.8, 2.2);

  const title = strVal(bp.slots.title);
  const subtitle = strVal(bp.slots.subtitle);
  const meta = strVal(bp.slots.byline) || strVal(bp.slots.meta);

  slide.addText(title, {
    x: 0.8,
    y: 2.5,
    w: SLIDE_W * 0.55,
    h: 2,
    fontSize: 54,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    valign: "top",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8,
      y: 4.8,
      w: SLIDE_W * 0.42,
      h: 1.5,
      fontSize: 18,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.textMuted,
      valign: "top",
    });
  }
  if (meta) {
    slide.addText(meta, {
      x: 0.8,
      y: SLIDE_H - 0.7,
      w: SLIDE_W * 0.55,
      h: 0.3,
      fontSize: 11,
      fontFace: BLUE_PRO_THEME.headingFont,
      color: BLUE_PRO_THEME.textLight,
      charSpacing: 1,
    });
  }
}

/** Agenda — 2 列 × 3 行的 6 格 numbered grid */
function renderAgenda(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  drawSlideHeader(slide, "Table of Contents", "Overview");
  drawAccentLine(slide, 0.8, 1.3);

  const items = listVal(bp.slots.items);
  const colW = (SLIDE_W - 1.6) / 2 - 0.2;
  const rowH = 1.6;
  const startY = 1.8;

  items.slice(0, 6).forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.8 + col * (colW + 0.4);
    const y = startY + row * rowH;

    // 大数字 01 02 ...
    slide.addText(String(idx + 1).padStart(2, "0"), {
      x,
      y,
      w: 1.0,
      h: 0.8,
      fontSize: 38,
      fontFace: BLUE_PRO_THEME.headingFont,
      bold: true,
      color: BLUE_PRO_THEME.primary,
      valign: "top",
    });
    // 标题 / 描述(slot 里只有 string,简单当 title 用,描述留空)
    // 若需更复杂可让 LLM 输出 [{title, desc}] 结构(后续 Phase)
    slide.addText(item, {
      x: x + 1.05,
      y,
      w: colW - 1.05,
      h: rowH - 0.2,
      fontSize: 14,
      fontFace: BLUE_PRO_THEME.headingFont,
      color: BLUE_PRO_THEME.text,
      valign: "top",
    });
  });
}

/** Content with big_number — SLIDE 3 metric card 风 */
function renderBigNumber(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const label = strVal(bp.slots.label);
  const bigNum = strVal(bp.slots.big_number);
  const caption = strVal(bp.slots.caption);

  drawSlideHeader(slide, label || "Highlight", "Key Finding");

  // 大数字居中
  slide.addText(bigNum, {
    x: 0.5,
    y: 2.3,
    w: SLIDE_W - 1,
    h: 2.4,
    fontSize: 144,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.primary,
    align: "center",
    valign: "middle",
  });

  if (caption) {
    drawAccentLine(slide, SLIDE_W / 2 - 0.31, 4.9);
    slide.addText(caption, {
      x: 1,
      y: 5.2,
      w: SLIDE_W - 2,
      h: 1.5,
      fontSize: 16,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.textMuted,
      align: "center",
      valign: "top",
    });
  }
}

/** Content with bullets — SLIDE 5 split 风(标题 + lead + bullets 列表) */
function renderContentBullets(
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint
): void {
  const title = strVal(bp.slots.title);
  const lead = strVal(bp.slots.lead);
  const bullets = listVal(bp.slots.bullets);

  drawSlideHeader(slide, "Analysis", "Insight");
  drawAccentLine(slide, 0.8, 1.3);

  slide.addText(title, {
    x: 0.8,
    y: 1.6,
    w: SLIDE_W - 1.6,
    h: 1.0,
    fontSize: 28,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    valign: "top",
  });

  let yCursor = 2.8;
  if (lead) {
    slide.addText(lead, {
      x: 0.8,
      y: yCursor,
      w: SLIDE_W - 1.6,
      h: 0.9,
      fontSize: 16,
      fontFace: BLUE_PRO_THEME.bodyFont,
      italic: true,
      color: BLUE_PRO_THEME.textMuted,
      valign: "top",
    });
    yCursor += 1.0;
  }

  if (bullets.length > 0) {
    slide.addText(
      bullets.map((b) => ({
        text: b,
        options: {
          bullet: { code: "25CF" }, // ● solid disc
          color: BLUE_PRO_THEME.text,
        },
      })),
      {
        x: 0.8,
        y: yCursor,
        w: SLIDE_W - 1.6,
        h: SLIDE_H - yCursor - 0.5,
        fontSize: 16,
        fontFace: BLUE_PRO_THEME.bodyFont,
        color: BLUE_PRO_THEME.text,
        paraSpaceAfter: 10,
      }
    );
  }
}

function renderSingleText(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title);
  const lead = strVal(bp.slots.lead);
  const body = strVal(bp.slots.body) || strVal(bp.slots.callout);

  drawSlideHeader(slide, "Brief", "Context");
  drawAccentLine(slide, 0.8, 1.35);
  slide.addText(title || lead, {
    x: 0.8,
    y: 1.7,
    w: SLIDE_W - 1.6,
    h: 1.2,
    fontSize: 34,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    fit: "shrink",
  });
  if (lead || body) {
    slide.addText([lead, body].filter(Boolean).join("\n"), {
      x: 1.1,
      y: 3.15,
      w: SLIDE_W - 2.2,
      h: 3.2,
      fontSize: 19,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.textMuted,
      breakLine: false,
      fit: "shrink",
    });
  }
}

function renderQuote(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const quote =
    strVal(bp.slots.quote) ||
    strVal(bp.slots.callout) ||
    strVal(bp.slots.title);
  const attribution = strVal(bp.slots.attribution) || strVal(bp.slots.caption);

  drawSlideHeader(slide, "Quote", "Callout");
  drawAccentLine(slide, SLIDE_W / 2 - 0.31, 1.45);
  slide.addText(quote, {
    x: 1.25,
    y: 2,
    w: SLIDE_W - 2.5,
    h: 2.8,
    fontSize: 46,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    align: "center",
    valign: "middle",
    fit: "shrink",
  });
  if (attribution) {
    slide.addText(attribution, {
      x: 2,
      y: 5.15,
      w: SLIDE_W - 4,
      h: 0.5,
      fontSize: 13,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.textLight,
      align: "center",
    });
  }
}

function renderComparison(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Comparison";
  const leftTitle = strVal(bp.slots.left_title) || "Before";
  const rightTitle = strVal(bp.slots.right_title) || "After";
  const leftItems = listVal(bp.slots.left_items);
  const rightItems = listVal(bp.slots.right_items);

  drawSlideHeader(slide, "Comparison", "A / B");
  slide.addText(title, {
    x: 0.8,
    y: 1.05,
    w: SLIDE_W - 1.6,
    h: 0.65,
    fontSize: 30,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    fit: "shrink",
  });

  const colW = (SLIDE_W - 2.1) / 2;
  const colY = 2.05;
  [
    { x: 0.8, title: leftTitle, items: leftItems, dim: true },
    { x: 1.3 + colW, title: rightTitle, items: rightItems, dim: false },
  ].forEach((col) => {
    slide.addShape("roundRect", {
      x: col.x,
      y: colY,
      w: colW,
      h: 4.7,
      fill: { color: col.dim ? "F5F6FB" : BLUE_PRO_THEME.cardBgHex },
      line: { color: col.dim ? "D7DAE8" : BLUE_PRO_THEME.primary, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(col.title, {
      x: col.x + 0.35,
      y: colY + 0.35,
      w: colW - 0.7,
      h: 0.45,
      fontSize: 20,
      fontFace: BLUE_PRO_THEME.headingFont,
      bold: true,
      color: BLUE_PRO_THEME.text,
    });
    if (col.items.length > 0) {
      slide.addText(
        col.items.map((it) => ({
          text: it,
          options: { bullet: { code: "2022" } },
        })),
        {
          x: col.x + 0.45,
          y: colY + 1.05,
          w: colW - 0.9,
          h: 3.35,
          fontSize: 15,
          fontFace: BLUE_PRO_THEME.bodyFont,
          color: BLUE_PRO_THEME.text,
          paraSpaceAfter: 9,
          fit: "shrink",
        },
      );
    }
  });
}

function renderTimeline(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Timeline";
  const steps = listVal(bp.slots.steps).slice(0, 5);

  drawSlideHeader(slide, "Timeline", "Sequence");
  slide.addText(title, {
    x: 0.8,
    y: 1.05,
    w: SLIDE_W - 1.6,
    h: 0.8,
    fontSize: 32,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    fit: "shrink",
  });

  const startX = 0.8;
  const stepW = (SLIDE_W - 1.6) / Math.max(steps.length, 1);
  slide.addShape("rect", {
    x: startX,
    y: 3.25,
    w: SLIDE_W - 1.6,
    h: 0.04,
    fill: { color: BLUE_PRO_THEME.primary },
    line: { color: BLUE_PRO_THEME.primary, width: 0 },
  });
  steps.forEach((step, idx) => {
    const x = startX + idx * stepW;
    slide.addText(String(idx + 1).padStart(2, "0"), {
      x,
      y: 2.45,
      w: stepW,
      h: 0.45,
      fontSize: 22,
      fontFace: BLUE_PRO_THEME.headingFont,
      bold: true,
      color: BLUE_PRO_THEME.primary,
      align: "center",
    });
    slide.addShape("ellipse", {
      x: x + stepW / 2 - 0.16,
      y: 3.1,
      w: 0.32,
      h: 0.32,
      fill: { color: BLUE_PRO_THEME.primary },
      line: { color: BLUE_PRO_THEME.primary, width: 0 },
    });
    slide.addText(step, {
      x: x + 0.12,
      y: 3.75,
      w: stepW - 0.24,
      h: 1.45,
      fontSize: 14,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.text,
      align: "center",
      fit: "shrink",
    });
  });
}

function renderTwoColumn(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Parallel View";
  const leftTitle = strVal(bp.slots.left_title);
  const rightTitle = strVal(bp.slots.right_title);
  const leftBody = strVal(bp.slots.left_body) || strVal(bp.slots.left);
  const rightBody = strVal(bp.slots.right_body) || strVal(bp.slots.right);

  drawSlideHeader(slide, "Parallel", "Two Tracks");
  slide.addText(title, {
    x: 0.8,
    y: 1.05,
    w: SLIDE_W - 1.6,
    h: 0.75,
    fontSize: 31,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    fit: "shrink",
  });
  [
    { x: 0.8, title: leftTitle, body: leftBody },
    { x: SLIDE_W / 2 + 0.25, title: rightTitle, body: rightBody },
  ].forEach((col) => {
    drawAccentLine(slide, col.x, 2.25, 0.5);
    slide.addText(col.title, {
      x: col.x,
      y: 2.45,
      w: 5.6,
      h: 0.55,
      fontSize: 22,
      fontFace: BLUE_PRO_THEME.headingFont,
      bold: true,
      color: BLUE_PRO_THEME.text,
    });
    slide.addText(col.body, {
      x: col.x,
      y: 3.15,
      w: 5.6,
      h: 2.9,
      fontSize: 17,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.textMuted,
      fit: "shrink",
    });
  });
}

/** Section divider — 全屏大标题 + accent line */
function renderSectionDivider(
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint
): void {
  const title = strVal(bp.slots.title);
  drawAccentLine(slide, SLIDE_W / 2 - 0.31, 3.0);
  slide.addText(title, {
    x: 0.5,
    y: 3.2,
    w: SLIDE_W - 1,
    h: 1.5,
    fontSize: 48,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.primary,
    align: "center",
    valign: "middle",
  });
}

/** Closing — SLIDE 10 Thank You 风 */
function renderClosing(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Thank You";
  const contact = strVal(bp.slots.contact);
  const sub = strVal(bp.slots.subtitle) || strVal(bp.slots.lead);

  drawAccentLine(slide, SLIDE_W / 2 - 0.31, 2.2);

  slide.addText(title, {
    x: 0.5,
    y: 2.5,
    w: SLIDE_W - 1,
    h: 1.5,
    fontSize: 72,
    fontFace: BLUE_PRO_THEME.headingFont,
    bold: true,
    color: BLUE_PRO_THEME.text,
    align: "center",
    valign: "middle",
  });

  if (sub) {
    slide.addText(sub, {
      x: 1.5,
      y: 4.5,
      w: SLIDE_W - 3,
      h: 1,
      fontSize: 16,
      fontFace: BLUE_PRO_THEME.bodyFont,
      color: BLUE_PRO_THEME.textMuted,
      align: "center",
      valign: "top",
    });
  }

  if (contact) {
    slide.addText(contact, {
      x: 0.5,
      y: SLIDE_H - 0.9,
      w: SLIDE_W - 1,
      h: 0.4,
      fontSize: 11,
      fontFace: BLUE_PRO_THEME.headingFont,
      color: BLUE_PRO_THEME.textLight,
      align: "center",
      charSpacing: 1,
    });
  }
}

/** 主入口:按 role 分发 */
export function renderBlueProfessionalSlide(
  _pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint
): void {
  slide.background = { color: BLUE_PRO_THEME.bg };

  switch (bp.role) {
    case "cover":
      renderCover(slide, bp);
      break;
    case "agenda":
      renderAgenda(slide, bp);
      break;
    case "content": {
      const intent = getSlideLayoutIntent(bp);
      if (intent === "big_number") renderBigNumber(slide, bp);
      else if (intent === "comparison") renderComparison(slide, bp);
      else if (intent === "timeline") renderTimeline(slide, bp);
      else if (intent === "quote") renderQuote(slide, bp);
      else if (intent === "two_column") renderTwoColumn(slide, bp);
      else if (intent === "single_text") renderSingleText(slide, bp);
      else renderContentBullets(slide, bp);
      break;
    }
    case "section_divider":
      renderSectionDivider(slide, bp);
      break;
    case "closing":
      renderClosing(slide, bp);
      break;
  }

  if (bp.speaker_notes) {
    slide.addNotes(bp.speaker_notes);
  }
}
