// Phase 2 续(2026-05-17):模板专属 pptxgenjs renderer 共享工具
//
// 设计:
//   - 每个模板有一个独立的 renderer 文件,各自维护 THEME 常量 + renderSlide
//   - 共享部分(slot 类型转换、画布常量、shadow 模拟)抽到这里
//   - 模板 renderer 之间互不依赖
//
// 关联:
//   - src/lib/slides/exporters/blueprint-to-pptx.ts(主入口,按 template_id 路由)
//   - src/lib/slides/blueprint/schema.ts(SlideBlueprint / SlotValue 类型)

import type PptxGenJS from "pptxgenjs";
import type { SlotValue } from "../../blueprint/schema";

/** 16:9 LAYOUT_WIDE 画布尺寸(英寸) */
export const SLIDE_W = 13.33;
export const SLIDE_H = 7.5;

export function strVal(v: SlotValue | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

export function listVal(v: SlotValue | undefined): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return [v];
  return [];
}

/**
 * 模拟 CSS text-shadow(pptxgenjs 没有 native shadow)
 *
 * 实现:在主文本前先画 N 层渐淡的 offset 文本(每层 opacity 降低 + 位置偏移)
 *
 * 用例:bold-poster 的 red-quote 用了 3 层 #1C1410 的 shadow,offset 2/4/6px
 *
 * 参数 opts.shadows:每层 { dx, dy, color, opacity }(px → 英寸自动换算)
 */
export function addTextWithShadow(
  slide: PptxGenJS.Slide,
  text: string,
  base: PptxGenJS.TextPropsOptions,
  shadows: Array<{
    dx: number;
    dy: number;
    color: string;
    opacity: number;
  }>
): void {
  // 先画阴影层(从最远 / 最淡的开始)
  for (const s of shadows) {
    slide.addText(text, {
      ...base,
      x: (base.x as number) + s.dx / 96, // 96 dpi 换算
      y: (base.y as number) + s.dy / 96,
      color: s.color,
      transparency: 100 - Math.round(s.opacity * 100), // pptxgenjs 是反向(0=不透,100=全透)
    });
  }
  // 主文本最后画(最上层)
  slide.addText(text, base);
}

/** 渐变填充(pptxgenjs 不支持 native gradient,用纯色 fallback) */
export function solidFill(color: string, transparency = 0) {
  return { color, transparency } as const;
}

/** 把 % 转 pptxgenjs 的英寸(基于画布宽) */
export function pctW(pct: number): number {
  return (SLIDE_W * pct) / 100;
}

export function pctH(pct: number): number {
  return (SLIDE_H * pct) / 100;
}
