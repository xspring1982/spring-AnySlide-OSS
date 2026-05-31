// Phase 2 PR34:Blueprint → Native PPTX exporter(pptxgenjs)
//
// 设计目标:
//   - 接受 DeckBlueprint(LLM 输出的纯 JSON,跟模板无关)
//   - 输出真 native .pptx 二进制(OOXML),用户在 PowerPoint 里完全可改文字 / 换色 / 重排
//   - 跟 HTML renderer 共享同一 blueprint 数据源(两条出口路径)
//
// 跟 AnyGen 的对照:
//   AnyGen: blueprint → Lark sml/2.0 → 飞书内部导出器 → .pptx
//   我们:   blueprint → pptxgenjs (直接写 OOXML 库) → .pptx
//   AnyGen 视觉品质更高(他们的导出器调了多年),我们做到 80-90% 够 MVP 用
//
// Phase 2 续(2026-05-17):按 template_id 路由到模板专属 renderer
//   - ext-blue-professional → templates/blue-professional-pptx.ts
//   - ext-bold-poster       → templates/bold-poster-pptx.ts
//   - 其他模板           → fall back to GENERIC renderer(本文件 renderSlideGeneric)
//   - 后续可逐步补完其他 41 个模板(每个独立文件,跟 HTML 模板 1:1 对应)

import PptxGenJS from "pptxgenjs";
import type {
  DeckBlueprint,
  SlideBlueprint,
  SlotValue,
} from "../blueprint/schema";
import { getSlideLayoutIntent } from "../blueprint/layout-intent";
import { renderBlueProfessionalSlide } from "./templates/blue-professional-pptx";
import { renderBoldPosterSlide } from "./templates/bold-poster-pptx";

/**
 * 模板 ID → 专属 renderer 注册表
 *
 * 添加新模板:
 *   1. 在 templates/ 下新建 <slug>-pptx.ts 导出 renderXxxSlide
 *   2. 在这里注册 templateId → renderer
 *   3. 在 demo-blueprint-to-pptx.ts 加一个 smoke case
 *
 * 跟 templates 数据库表的 id 字段对应(seed-external-templates.ts 灌入)
 */
const TEMPLATE_RENDERERS: Record<
  string,
  (
    pres: PptxGenJS,
    slide: PptxGenJS.Slide,
    bp: SlideBlueprint
  ) => void
> = {
  "ext-blue-professional": renderBlueProfessionalSlide,
  "ext-bold-poster": renderBoldPosterSlide,
};

/** 默认主题(MVP 通用版,等同 demo-template.html 的 CSS 变量) */
const DEFAULT_THEME = {
  bgColor: "FFFFFF",
  textColor: "1F2937",
  mutedColor: "6B7280",
  accentColor: "3B82F6",
  headingFont: "PingFang SC", // Mac/iOS;Windows 用户系统自动 fallback 到 Microsoft YaHei
  bodyFont: "PingFang SC",
} as const;

/** Phase 5:把 blueprint.meta.inheritedTheme 合并到 DEFAULT_THEME(可选 override) */
function resolveTheme(deckMeta: import("../blueprint/schema").DeckBlueprintMeta): {
  bgColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
} {
  const ih = deckMeta.inheritedTheme;
  return {
    bgColor: ih?.colors?.bg || DEFAULT_THEME.bgColor,
    textColor: ih?.colors?.text || DEFAULT_THEME.textColor,
    mutedColor: ih?.colors?.muted || DEFAULT_THEME.mutedColor,
    accentColor: ih?.colors?.accent || DEFAULT_THEME.accentColor,
    headingFont: ih?.fonts?.heading || DEFAULT_THEME.headingFont,
    bodyFont: ih?.fonts?.body || DEFAULT_THEME.bodyFont,
  };
}

/** 16:9 默认尺寸(英寸,pptxgenjs 标准)*/
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

function strVal(v: SlotValue | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function listVal(v: SlotValue | undefined): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return [v];
  return [];
}

type ResolvedTheme = ReturnType<typeof resolveTheme>;

function textBlock(values: Array<string | undefined>): string {
  return values.filter(Boolean).join("\n");
}

function renderGenericTitle(slide: PptxGenJS.Slide, title: string, theme: ResolvedTheme): void {
  slide.addText(title, {
    x: 0.8,
    y: 0.55,
    w: SLIDE_W - 1.6,
    h: 0.8,
    fontSize: 32,
    fontFace: theme.headingFont,
    bold: true,
    color: theme.textColor,
    fit: "shrink",
  });
}

function addGenericBullets(
  slide: PptxGenJS.Slide,
  bullets: string[],
  opts: PptxGenJS.TextPropsOptions,
): void {
  if (bullets.length === 0) return;
  slide.addText(
    bullets.map((b) => ({ text: b, options: { bullet: { code: "2192" } } })),
    opts,
  );
}

/** 给单页 slide 添内容,按 role 决定 layout(GENERIC fallback — 模板专属 renderer 见 templates/) */
function renderSlideGeneric(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  bp: SlideBlueprint,
  theme: ResolvedTheme,
): void {
  // 整页背景
  slide.background = { color: theme.bgColor };

  switch (bp.role) {
    case "cover": {
      // 居中大标题 + 副标题 + 底部署名
      const title = strVal(bp.slots.title);
      const subtitle = strVal(bp.slots.subtitle);
      const byline = strVal(bp.slots.byline);

      slide.addText(title, {
        x: 0.5,
        y: 2.5,
        w: SLIDE_W - 1,
        h: 1.5,
        fontSize: 54,
        fontFace: theme.headingFont,
        bold: true,
        color: theme.textColor,
        align: "center",
        valign: "middle",
      });
      if (subtitle) {
        slide.addText(subtitle, {
          x: 0.5,
          y: 4.2,
          w: SLIDE_W - 1,
          h: 0.6,
          fontSize: 20,
          fontFace: theme.headingFont,
          color: theme.mutedColor,
          align: "center",
        });
      }
      if (byline) {
        slide.addText(byline, {
          x: 0.5,
          y: SLIDE_H - 0.8,
          w: SLIDE_W - 1,
          h: 0.3,
          fontSize: 12,
          fontFace: theme.headingFont,
          color: theme.mutedColor,
          align: "center",
        });
      }
      break;
    }

    case "agenda": {
      const title = strVal(bp.slots.title);
      const items = listVal(bp.slots.items);

      slide.addText(title, {
        x: 0.8,
        y: 0.6,
        w: SLIDE_W - 1.6,
        h: 0.8,
        fontSize: 36,
        fontFace: theme.headingFont,
        bold: true,
        color: theme.textColor,
      });
      // bullet list
      if (items.length > 0) {
        slide.addText(
          items.map((it) => ({ text: it, options: { bullet: { code: "2192" } } })),
          {
            x: 0.8,
            y: 1.8,
            w: SLIDE_W - 1.6,
            h: SLIDE_H - 2.2,
            fontSize: 22,
            fontFace: theme.headingFont,
            color: theme.textColor,
            paraSpaceAfter: 16,
          },
        );
      }
      break;
    }

    case "content": {
      // 通用 content 版式 — 先看 layout_intent,再用 slot 兜底
      const intent = getSlideLayoutIntent(bp);
      const title = strVal(bp.slots.title);
      const lead = strVal(bp.slots.lead);
      const body = strVal(bp.slots.body);
      const bullets = listVal(bp.slots.bullets);
      const bigNum = strVal(bp.slots.big_number);
      const label = strVal(bp.slots.label);
      const caption = strVal(bp.slots.caption);

      if (intent === "big_number" || bigNum) {
        if (label) {
          slide.addText(label, {
            x: 0.5,
            y: 2.2,
            w: SLIDE_W - 1,
            h: 0.5,
            fontSize: 22,
            fontFace: theme.headingFont,
            color: theme.mutedColor,
            align: "center",
          });
        }
        slide.addText(bigNum, {
          x: 0.5,
          y: 2.7,
          w: SLIDE_W - 1,
          h: 2.2,
          fontSize: 140,
          fontFace: theme.headingFont,
          bold: true,
          color: theme.accentColor,
          align: "center",
        });
        if (caption) {
          slide.addText(caption, {
            x: 0.5,
            y: 5.2,
            w: SLIDE_W - 1,
            h: 0.6,
            fontSize: 16,
            fontFace: theme.headingFont,
            color: theme.mutedColor,
            align: "center",
          });
        }
        break;
      }

      if (intent === "quote") {
        const quote = strVal(bp.slots.quote) || strVal(bp.slots.callout) || title;
        const attribution = strVal(bp.slots.attribution) || caption;
        slide.addText(quote, {
          x: 1.2,
          y: 1.7,
          w: SLIDE_W - 2.4,
          h: 3.2,
          fontSize: 44,
          fontFace: theme.headingFont,
          bold: true,
          color: theme.textColor,
          align: "center",
          valign: "middle",
          fit: "shrink",
        });
        if (attribution) {
          slide.addText(attribution, {
            x: 2,
            y: 5.25,
            w: SLIDE_W - 4,
            h: 0.4,
            fontSize: 14,
            fontFace: theme.bodyFont,
            color: theme.mutedColor,
            align: "center",
          });
        }
        break;
      }

      if (intent === "comparison") {
        renderGenericTitle(slide, title || "对比", theme);
        const leftTitle = strVal(bp.slots.left_title) || "Before";
        const rightTitle = strVal(bp.slots.right_title) || "After";
        const leftItems = listVal(bp.slots.left_items);
        const rightItems = listVal(bp.slots.right_items);
        const colY = 1.65;
        const colH = 5.15;
        const colW = (SLIDE_W - 2.1) / 2;
        [
          { x: 0.8, title: leftTitle, items: leftItems, muted: true },
          { x: 1.3 + colW, title: rightTitle, items: rightItems, muted: false },
        ].forEach((col) => {
          slide.addShape("roundRect", {
            x: col.x,
            y: colY,
            w: colW,
            h: colH,
            fill: { color: col.muted ? "F3F4F6" : "EFF6FF" },
            line: { color: col.muted ? "D1D5DB" : theme.accentColor, width: 1 },
            rectRadius: 0.12,
          });
          slide.addText(col.title, {
            x: col.x + 0.35,
            y: colY + 0.35,
            w: colW - 0.7,
            h: 0.5,
            fontSize: 22,
            fontFace: theme.headingFont,
            bold: true,
            color: theme.textColor,
          });
          addGenericBullets(slide, col.items, {
            x: col.x + 0.45,
            y: colY + 1.1,
            w: colW - 0.9,
            h: colH - 1.35,
            fontSize: 16,
            fontFace: theme.bodyFont,
            color: theme.textColor,
            paraSpaceAfter: 10,
            fit: "shrink",
          });
        });
        break;
      }

      if (intent === "timeline") {
        renderGenericTitle(slide, title || "流程", theme);
        const steps = listVal(bp.slots.steps).slice(0, 5);
        const startX = 0.9;
        const stepW = (SLIDE_W - 1.8) / Math.max(steps.length, 1);
        slide.addShape("rect", {
          x: startX,
          y: 3.0,
          w: SLIDE_W - 1.8,
          h: 0.04,
          fill: { color: theme.accentColor },
          line: { color: theme.accentColor, width: 0 },
        });
        steps.forEach((step, idx) => {
          const x = startX + idx * stepW;
          slide.addShape("ellipse", {
            x: x + stepW / 2 - 0.18,
            y: 2.84,
            w: 0.36,
            h: 0.36,
            fill: { color: theme.accentColor },
            line: { color: theme.accentColor, width: 0 },
          });
          slide.addText(String(idx + 1).padStart(2, "0"), {
            x,
            y: 2.25,
            w: stepW,
            h: 0.35,
            fontSize: 14,
            fontFace: theme.headingFont,
            bold: true,
            color: theme.accentColor,
            align: "center",
          });
          slide.addText(step, {
            x: x + 0.1,
            y: 3.35,
            w: stepW - 0.2,
            h: 1.4,
            fontSize: 15,
            fontFace: theme.bodyFont,
            color: theme.textColor,
            align: "center",
            valign: "top",
            fit: "shrink",
          });
        });
        break;
      }

      if (intent === "two_column") {
        renderGenericTitle(slide, title || "并列要点", theme);
        const left = textBlock([
          strVal(bp.slots.left_title),
          strVal(bp.slots.left_body) || strVal(bp.slots.left),
        ]);
        const right = textBlock([
          strVal(bp.slots.right_title),
          strVal(bp.slots.right_body) || strVal(bp.slots.right),
        ]);
        slide.addText(left, {
          x: 0.9,
          y: 1.8,
          w: 5.5,
          h: 4.8,
          fontSize: 20,
          fontFace: theme.bodyFont,
          color: theme.textColor,
          breakLine: false,
          fit: "shrink",
        });
        slide.addShape("rect", {
          x: SLIDE_W / 2 - 0.01,
          y: 1.7,
          w: 0.02,
          h: 4.9,
          fill: { color: theme.accentColor, transparency: 35 },
          line: { color: theme.accentColor, width: 0, transparency: 35 },
        });
        slide.addText(right, {
          x: 6.95,
          y: 1.8,
          w: 5.5,
          h: 4.8,
          fontSize: 20,
          fontFace: theme.bodyFont,
          color: theme.textColor,
          fit: "shrink",
        });
        break;
      }

      if (intent === "single_text") {
        renderGenericTitle(slide, title || lead || body, theme);
        const text = textBlock([lead, body || strVal(bp.slots.callout)]);
        if (text) {
          slide.addText(text, {
            x: 1.1,
            y: 2,
            w: SLIDE_W - 2.2,
            h: 4.2,
            fontSize: 23,
            fontFace: theme.bodyFont,
            color: theme.textColor,
            valign: "middle",
            fit: "shrink",
          });
        }
        break;
      }

      // 默认:bullets + lead 模式
      renderGenericTitle(slide, title, theme);
      let yCursor = 1.8;
      if (lead) {
        slide.addText(lead, {
          x: 0.8,
          y: yCursor,
          w: SLIDE_W - 1.6,
          h: 0.9,
          fontSize: 18,
          fontFace: theme.headingFont,
          color: theme.mutedColor,
        });
        yCursor += 1.1;
      }
      if (bullets.length > 0) {
        slide.addText(
          bullets.map((b) => ({ text: b, options: { bullet: { code: "2192" } } })),
          {
            x: 0.8,
            y: yCursor,
            w: SLIDE_W - 1.6,
            h: SLIDE_H - yCursor - 0.5,
            fontSize: 18,
            fontFace: theme.headingFont,
            color: theme.textColor,
            paraSpaceAfter: 12,
          },
        );
      }
      break;
    }

    case "section_divider": {
      const title = strVal(bp.slots.title);
      slide.addText(title, {
        x: 0.5,
        y: 3.0,
        w: SLIDE_W - 1,
        h: 1.5,
        fontSize: 48,
        fontFace: theme.headingFont,
        bold: true,
        color: theme.accentColor,
        align: "center",
        valign: "middle",
      });
      break;
    }

    case "closing": {
      const title = strVal(bp.slots.title);
      const contact = strVal(bp.slots.contact);
      slide.addText(title, {
        x: 0.5,
        y: 2.8,
        w: SLIDE_W - 1,
        h: 1.5,
        fontSize: 64,
        fontFace: theme.headingFont,
        bold: true,
        color: theme.textColor,
        align: "center",
        valign: "middle",
      });
      if (contact) {
        slide.addText(contact, {
          x: 0.5,
          y: 4.5,
          w: SLIDE_W - 1,
          h: 0.6,
          fontSize: 18,
          fontFace: theme.headingFont,
          color: theme.mutedColor,
          align: "center",
        });
      }
      break;
    }
  }

  // 演讲者备注(PowerPoint 原生 notes 面板)
  if (bp.speaker_notes) {
    slide.addNotes(bp.speaker_notes);
  }
}

/**
 * 主入口:整份 DeckBlueprint → .pptx Node Buffer
 *
 * 用法:
 *   const buf = await blueprintToPptx(deck);
 *   fs.writeFileSync("out.pptx", buf);
 *   // 用户在 PowerPoint 打开 out.pptx,可改文字、换色、重排
 */
export async function blueprintToPptx(deck: DeckBlueprint): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 (16:9)
  pres.title = deck.meta.title || deck.meta.topic || "AnySlide Deck";
  pres.author = "AnySlide";
  pres.company = "AnySlide";

  // Phase 5:基于 inheritedTheme(用户上传 PPT 提的 theme)覆盖默认色 / 字
  const theme = resolveTheme(deck.meta);

  // Phase 2 续:按 template_id 路由到专属 renderer
  // 注意:模板专属 renderer **不读** inheritedTheme,因为用户主动选模板时
  // 应该看到模板原汁原味的视觉,而非"我的色 × 模板 layout"的混搭。
  // 如果用户想"保留我的色 × 通用 layout",就不选模板,走 generic fallback。
  const templateRenderer = TEMPLATE_RENDERERS[deck.meta.template_id];

  for (const bp of deck.slides) {
    const slide = pres.addSlide();
    if (templateRenderer) {
      templateRenderer(pres, slide, bp);
    } else {
      renderSlideGeneric(pres, slide, bp, theme);
    }
  }

  // pptxgenjs 的 nodebuffer 输出
  const out = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
