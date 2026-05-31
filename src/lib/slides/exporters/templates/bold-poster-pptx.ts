// Phase 2 续 PR50:ext-bold-poster 模板的 pptxgenjs 专属实现
//
// 视觉来源:src/lib/slides/templates/external/bold-poster.html
// 配色:纯白 #FFFFFF + 深暖灰黑 #1C1410 + 强红 #D8000F + 米灰 #F5F2EF
// 字体:Shrikhand(display 装饰 cursive)+ Libre Baskerville(serif body)+ Space Grotesk(sans label)
//
// 视觉特征(挑战点):
//   - 大字旋转(hero -4°/-6°,closing -5°),pptxgenjs 用 rotate 支持
//   - 三层 text-shadow(red statement),用 _shared.addTextWithShadow 模拟
//   - 红色 4px 左边框(svc-card),用 1×N rect shape 模拟
//   - 黑色 hairline 网格(fin-grid),用 N 个 line shape 拼
//
// Role 映射:
//   cover           → SLIDE 1 hero(rotated Shrikhand 大字 + 右下角小 italic 标语)
//   agenda          → SLIDE 8 pillars 风(交替 bg 全高分栏 + 大数字 + 标题)
//   content+bullets → SLIDE 6 services(红 4px 左边框卡片)
//   content+big_num → SLIDE 5 big-stat(超大旋转红 Shrikhand 数字 + sub items)
//   section_divider → SLIDE 2 red-statement(全红 bg + 白 Shrikhand quote)
//   closing         → SLIDE 10 close(massive rotated red "Thanks" + italic sub)

import type PptxGenJS from "pptxgenjs";
import type { SlideBlueprint } from "../../blueprint/schema";
import { getSlideLayoutIntent } from "../../blueprint/layout-intent";
import {
  SLIDE_W,
  SLIDE_H,
  strVal,
  listVal,
  addTextWithShadow,
} from "./_shared";

/** ext-bold-poster theme — 跟 HTML CSS variables 一致 */
export const BOLD_POSTER_THEME = {
  bg: "FFFFFF",
  dark: "1C1410",
  red: "D8000F",
  light: "F5F2EF",
  displayFont: "Shrikhand",
  serifFont: "Libre Baskerville",
  sansFont: "Space Grotesk",
} as const;

/** 红 4px 左边框装饰(svc-card / rm-phase 共用) */
function drawRedLeftBar(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  h: number,
  color: string = BOLD_POSTER_THEME.red
): void {
  slide.addShape("rect", {
    x,
    y,
    w: 0.05,
    h,
    fill: { color },
    line: { color, width: 0 },
  });
}

/** Cover — SLIDE 1 hero 风:左上 Shrikhand 大字 + 旋转红色 overlay + 右下小 italic */
function renderCover(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Bold Statement";
  const subtitle = strVal(bp.slots.subtitle);
  const meta = strVal(bp.slots.byline) || strVal(bp.slots.meta);

  // 小 italic meta(顶部)
  if (meta) {
    slide.addText(meta, {
      x: 0.9,
      y: 0.5,
      w: SLIDE_W - 1.8,
      h: 0.4,
      fontSize: 12,
      fontFace: BOLD_POSTER_THEME.serifFont,
      italic: true,
      color: BOLD_POSTER_THEME.dark,
      transparency: 40,
      charSpacing: 0.5,
    });
  }

  // 主标题(深色 Shrikhand)— 拆 2 行让旋转 overlay 落在中间感
  // 简化:全部一行 Shrikhand,旋转控制在 -3 度内
  slide.addText(title, {
    x: 0.9,
    y: 1.4,
    w: SLIDE_W * 0.9,
    h: 3.5,
    fontSize: 100,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.dark,
    valign: "middle",
    fit: "shrink",
  });

  // 右下角小标签 + 标语
  if (subtitle) {
    const tagX = SLIDE_W - 4;
    const tagY = SLIDE_H - 1.8;
    slide.addText("CHAPTER 01", {
      x: tagX,
      y: tagY,
      w: 3,
      h: 0.3,
      fontSize: 10,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.red,
      charSpacing: 3,
      align: "right",
    });
    slide.addText(subtitle, {
      x: tagX,
      y: tagY + 0.35,
      w: 3,
      h: 1.2,
      fontSize: 13,
      fontFace: BOLD_POSTER_THEME.serifFont,
      italic: true,
      color: BOLD_POSTER_THEME.dark,
      align: "right",
      valign: "top",
    });
  }
}

/** Agenda — SLIDE 8 pillars 风:全高分栏 + 交替 bg + 大数字 */
function renderAgenda(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const items = listVal(bp.slots.items);
  const cols = Math.min(items.length || 3, 4);
  const colW = SLIDE_W / cols;

  items.slice(0, cols).forEach((item, idx) => {
    const x = idx * colW;
    // 交替 bg(奇数 col 用 light)
    if (idx % 2 === 1) {
      slide.addShape("rect", {
        x,
        y: 0,
        w: colW,
        h: SLIDE_H,
        fill: { color: BOLD_POSTER_THEME.light },
        line: { color: BOLD_POSTER_THEME.light, width: 0 },
      });
    }
    // 列右边竖线(除最后一列)
    if (idx < cols - 1) {
      slide.addShape("rect", {
        x: x + colW - 0.02,
        y: 0,
        w: 0.04,
        h: SLIDE_H,
        fill: { color: BOLD_POSTER_THEME.dark },
        line: { color: BOLD_POSTER_THEME.dark, width: 0 },
      });
    }
    // 大数字 01 02 ...
    slide.addText(String(idx + 1).padStart(2, "0"), {
      x: x + 0.3,
      y: 0.8,
      w: colW - 0.6,
      h: 1.2,
      fontSize: 56,
      fontFace: BOLD_POSTER_THEME.displayFont,
      color: BOLD_POSTER_THEME.red,
      valign: "top",
    });
    // 项目内容(Shrikhand 黑色)
    slide.addText(item, {
      x: x + 0.3,
      y: 2.4,
      w: colW - 0.6,
      h: SLIDE_H - 3,
      fontSize: 22,
      fontFace: BOLD_POSTER_THEME.displayFont,
      color: BOLD_POSTER_THEME.dark,
      valign: "top",
      fit: "shrink",
    });
  });
}

/** Content + big_number — SLIDE 5 大旋转红字风 */
function renderBigNumber(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const label = strVal(bp.slots.label);
  const bigNum = strVal(bp.slots.big_number);
  const caption = strVal(bp.slots.caption);

  // 旋转大数字(红 Shrikhand,中心位置)
  slide.addText(bigNum, {
    x: 1,
    y: 1,
    w: SLIDE_W - 2,
    h: 4,
    fontSize: 240,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.red,
    align: "center",
    valign: "middle",
    rotate: -6,
    fit: "shrink",
  });

  if (label) {
    slide.addText(label.toUpperCase(), {
      x: 0.5,
      y: 5.2,
      w: SLIDE_W - 1,
      h: 0.4,
      fontSize: 11,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.dark,
      charSpacing: 3,
      align: "center",
    });
  }
  if (caption) {
    slide.addText(caption, {
      x: 1.5,
      y: 5.7,
      w: SLIDE_W - 3,
      h: 1.3,
      fontSize: 14,
      fontFace: BOLD_POSTER_THEME.serifFont,
      italic: true,
      color: BOLD_POSTER_THEME.dark,
      transparency: 30,
      align: "center",
      valign: "top",
    });
  }
}

/** Content + bullets — SLIDE 6 services(红 4px 左边框卡片) */
function renderContentBullets(
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint
): void {
  const title = strVal(bp.slots.title);
  const lead = strVal(bp.slots.lead);
  const bullets = listVal(bp.slots.bullets);

  // 顶部 Shrikhand 大标题
  slide.addText(title, {
    x: 0.7,
    y: 0.5,
    w: SLIDE_W - 1.4,
    h: 1.3,
    fontSize: 48,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.dark,
    valign: "top",
    fit: "shrink",
  });

  // 红色 4px 左边框 + lead/bullets 卡片
  const cardX = 0.9;
  const cardY = 2.0;
  const cardH = SLIDE_H - cardY - 0.6;
  drawRedLeftBar(slide, cardX - 0.05, cardY, cardH);

  let yCursor = cardY;
  if (lead) {
    slide.addText(lead, {
      x: cardX + 0.1,
      y: yCursor,
      w: SLIDE_W - cardX - 0.5,
      h: 1.0,
      fontSize: 16,
      fontFace: BOLD_POSTER_THEME.serifFont,
      italic: true,
      color: BOLD_POSTER_THEME.dark,
      transparency: 20,
      valign: "top",
    });
    yCursor += 1.1;
  }

  if (bullets.length > 0) {
    slide.addText(
      bullets.map((b) => ({
        text: b,
        options: {
          bullet: { code: "2014" }, // — em dash(跟 HTML 一致)
          color: BOLD_POSTER_THEME.red,
        },
      })),
      {
        x: cardX + 0.1,
        y: yCursor,
        w: SLIDE_W - cardX - 0.5,
        h: cardH - (yCursor - cardY) - 0.2,
        fontSize: 14,
        fontFace: BOLD_POSTER_THEME.sansFont,
        color: BOLD_POSTER_THEME.dark,
        paraSpaceAfter: 10,
      }
    );
  }
}

function renderSingleText(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || strVal(bp.slots.lead);
  const lead = strVal(bp.slots.lead);
  const body = strVal(bp.slots.body) || strVal(bp.slots.callout);

  slide.addText(title, {
    x: 0.75,
    y: 0.8,
    w: SLIDE_W - 1.5,
    h: 1.5,
    fontSize: 54,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.dark,
    fit: "shrink",
  });
  drawRedLeftBar(slide, 1.05, 2.8, 3.3);
  slide.addText([lead, body].filter(Boolean).join("\n"), {
    x: 1.25,
    y: 2.75,
    w: SLIDE_W - 2.5,
    h: 3.35,
    fontSize: 21,
    fontFace: BOLD_POSTER_THEME.serifFont,
    italic: true,
    color: BOLD_POSTER_THEME.dark,
    transparency: 15,
    fit: "shrink",
  });
}

function renderQuote(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const quote =
    strVal(bp.slots.quote) ||
    strVal(bp.slots.callout) ||
    strVal(bp.slots.title);
  const attribution = strVal(bp.slots.attribution) || strVal(bp.slots.caption);

  slide.background = { color: BOLD_POSTER_THEME.red };
  addTextWithShadow(
    slide,
    quote,
    {
      x: 0.9,
      y: 1.3,
      w: SLIDE_W - 1.8,
      h: 4.3,
      fontSize: 74,
      fontFace: BOLD_POSTER_THEME.displayFont,
      color: BOLD_POSTER_THEME.bg,
      align: "center",
      valign: "middle",
      fit: "shrink",
    },
    [
      { dx: 6, dy: 6, color: BOLD_POSTER_THEME.dark, opacity: 0.15 },
      { dx: 3, dy: 3, color: BOLD_POSTER_THEME.dark, opacity: 0.24 },
    ]
  );
  if (attribution) {
    slide.addText(attribution, {
      x: 2,
      y: 6.05,
      w: SLIDE_W - 4,
      h: 0.45,
      fontSize: 13,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.bg,
      charSpacing: 2,
      align: "center",
    });
  }
}

function renderComparison(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Before / After";
  const leftTitle = strVal(bp.slots.left_title) || "Before";
  const rightTitle = strVal(bp.slots.right_title) || "After";
  const leftItems = listVal(bp.slots.left_items);
  const rightItems = listVal(bp.slots.right_items);

  slide.addText(title, {
    x: 0.65,
    y: 0.45,
    w: SLIDE_W - 1.3,
    h: 1.1,
    fontSize: 44,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.dark,
    fit: "shrink",
  });

  const colY = 1.9;
  const colH = 4.95;
  const colW = (SLIDE_W - 2.1) / 2;
  [
    { x: 0.75, title: leftTitle, items: leftItems, bg: BOLD_POSTER_THEME.light },
    { x: 1.35 + colW, title: rightTitle, items: rightItems, bg: "FFFFFF" },
  ].forEach((col, idx) => {
    slide.addShape("rect", {
      x: col.x,
      y: colY,
      w: colW,
      h: colH,
      fill: { color: col.bg },
      line: { color: BOLD_POSTER_THEME.dark, width: 1 },
    });
    drawRedLeftBar(slide, col.x, colY, colH);
    slide.addText(String(idx + 1).padStart(2, "0"), {
      x: col.x + 0.35,
      y: colY + 0.25,
      w: 1.1,
      h: 0.7,
      fontSize: 34,
      fontFace: BOLD_POSTER_THEME.displayFont,
      color: BOLD_POSTER_THEME.red,
    });
    slide.addText(col.title, {
      x: col.x + 1.35,
      y: colY + 0.35,
      w: colW - 1.7,
      h: 0.55,
      fontSize: 20,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.dark,
      fit: "shrink",
    });
    if (col.items.length > 0) {
      slide.addText(
        col.items.map((item) => ({
          text: item,
          options: { bullet: { code: "2014" } },
        })),
        {
          x: col.x + 0.45,
          y: colY + 1.35,
          w: colW - 0.75,
          h: colH - 1.65,
          fontSize: 14,
          fontFace: BOLD_POSTER_THEME.sansFont,
          color: BOLD_POSTER_THEME.dark,
          paraSpaceAfter: 9,
          fit: "shrink",
        }
      );
    }
  });
}

function renderTimeline(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Roadmap";
  const steps = listVal(bp.slots.steps).slice(0, 5);

  slide.addText(title, {
    x: 0.7,
    y: 0.55,
    w: SLIDE_W - 1.4,
    h: 1.2,
    fontSize: 46,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.dark,
    fit: "shrink",
  });

  const startX = 0.9;
  const stepW = (SLIDE_W - 1.8) / Math.max(steps.length, 1);
  slide.addShape("rect", {
    x: startX,
    y: 3.25,
    w: SLIDE_W - 1.8,
    h: 0.05,
    fill: { color: BOLD_POSTER_THEME.dark },
    line: { color: BOLD_POSTER_THEME.dark, width: 0 },
  });
  steps.forEach((step, idx) => {
    const x = startX + idx * stepW;
    slide.addText(String(idx + 1).padStart(2, "0"), {
      x,
      y: 2.25,
      w: stepW,
      h: 0.6,
      fontSize: 34,
      fontFace: BOLD_POSTER_THEME.displayFont,
      color: BOLD_POSTER_THEME.red,
      align: "center",
    });
    slide.addShape("ellipse", {
      x: x + stepW / 2 - 0.18,
      y: 3.07,
      w: 0.36,
      h: 0.36,
      fill: { color: BOLD_POSTER_THEME.red },
      line: { color: BOLD_POSTER_THEME.red, width: 0 },
    });
    slide.addText(step, {
      x: x + 0.1,
      y: 3.85,
      w: stepW - 0.2,
      h: 1.45,
      fontSize: 13,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.dark,
      align: "center",
      fit: "shrink",
    });
  });
}

function renderTwoColumn(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Two Tracks";
  const leftTitle = strVal(bp.slots.left_title);
  const rightTitle = strVal(bp.slots.right_title);
  const leftBody = strVal(bp.slots.left_body) || strVal(bp.slots.left);
  const rightBody = strVal(bp.slots.right_body) || strVal(bp.slots.right);

  slide.addText(title, {
    x: 0.7,
    y: 0.55,
    w: SLIDE_W - 1.4,
    h: 1.2,
    fontSize: 46,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.dark,
    fit: "shrink",
  });
  [
    { x: 0.85, title: leftTitle, body: leftBody },
    { x: SLIDE_W / 2 + 0.35, title: rightTitle, body: rightBody },
  ].forEach((col) => {
    drawRedLeftBar(slide, col.x, 2.15, 4.4);
    slide.addText(col.title, {
      x: col.x + 0.25,
      y: 2.2,
      w: 5.25,
      h: 0.6,
      fontSize: 21,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.red,
      fit: "shrink",
    });
    slide.addText(col.body, {
      x: col.x + 0.25,
      y: 3.05,
      w: 5.25,
      h: 3.2,
      fontSize: 17,
      fontFace: BOLD_POSTER_THEME.serifFont,
      italic: true,
      color: BOLD_POSTER_THEME.dark,
      transparency: 15,
      fit: "shrink",
    });
  });
}

/** Section divider — SLIDE 2 red-statement(全红 bg + 白 Shrikhand quote + text-shadow) */
function renderSectionDivider(
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint
): void {
  slide.background = { color: BOLD_POSTER_THEME.red };

  const title = strVal(bp.slots.title);

  // 三层 shadow + 主文本(模拟 CSS text-shadow)
  addTextWithShadow(
    slide,
    title,
    {
      x: 1,
      y: 1.5,
      w: SLIDE_W - 2,
      h: 4.5,
      fontSize: 80,
      fontFace: BOLD_POSTER_THEME.displayFont,
      color: BOLD_POSTER_THEME.bg,
      align: "center",
      valign: "middle",
      fit: "shrink",
    },
    [
      { dx: 6, dy: 6, color: BOLD_POSTER_THEME.dark, opacity: 0.15 },
      { dx: 4, dy: 4, color: BOLD_POSTER_THEME.dark, opacity: 0.2 },
      { dx: 2, dy: 2, color: BOLD_POSTER_THEME.dark, opacity: 0.25 },
    ]
  );
}

/** Closing — SLIDE 10 massive rotated "Thanks" */
function renderClosing(slide: PptxGenJS.Slide, bp: SlideBlueprint): void {
  const title = strVal(bp.slots.title) || "Thanks";
  const sub = strVal(bp.slots.subtitle) || strVal(bp.slots.lead);
  const contact = strVal(bp.slots.contact);

  // 旋转大字
  slide.addText(title, {
    x: 0.5,
    y: 1,
    w: SLIDE_W - 1,
    h: 3.5,
    fontSize: 200,
    fontFace: BOLD_POSTER_THEME.displayFont,
    color: BOLD_POSTER_THEME.red,
    align: "center",
    valign: "middle",
    rotate: -5,
    fit: "shrink",
  });

  if (sub) {
    slide.addText(sub, {
      x: 2,
      y: 5,
      w: SLIDE_W - 4,
      h: 1.2,
      fontSize: 16,
      fontFace: BOLD_POSTER_THEME.serifFont,
      italic: true,
      color: BOLD_POSTER_THEME.dark,
      align: "center",
      valign: "top",
    });
  }

  if (contact) {
    // 模拟 HTML 中 close-links 风:大写 + sans + letter-spacing + 红色下划线
    slide.addText(contact, {
      x: 1,
      y: SLIDE_H - 0.9,
      w: SLIDE_W - 2,
      h: 0.4,
      fontSize: 11,
      fontFace: BOLD_POSTER_THEME.sansFont,
      bold: true,
      color: BOLD_POSTER_THEME.dark,
      charSpacing: 2,
      align: "center",
      underline: { style: "sng", color: BOLD_POSTER_THEME.red },
    });
  }
}

export function renderBoldPosterSlide(
  _pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint
): void {
  slide.background = { color: BOLD_POSTER_THEME.bg };

  switch (bp.role) {
    case "cover":
      renderCover(slide, bp);
      break;
    case "agenda":
      renderAgenda(slide, bp);
      break;
    case "content": {
      const intent = getSlideLayoutIntent(bp);
      if (intent === "big_number" || strVal(bp.slots.big_number)) {
        renderBigNumber(slide, bp);
      } else if (intent === "quote") {
        renderQuote(slide, bp);
      } else if (intent === "comparison") {
        renderComparison(slide, bp);
      } else if (intent === "timeline") {
        renderTimeline(slide, bp);
      } else if (intent === "two_column") {
        renderTwoColumn(slide, bp);
      } else if (intent === "single_text") {
        renderSingleText(slide, bp);
      } else {
        renderContentBullets(slide, bp);
      }
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
