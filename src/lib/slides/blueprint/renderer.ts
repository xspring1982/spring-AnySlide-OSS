// Phase 1 PR31:Blueprint → HTML renderer
//
// 输入:SlideBlueprint(LLM 输出的 JSON 槽位填充表)+ section HTML(模板里这页的部分)
// 输出:渲染好的 HTML(把 data-slot 标记的元素 innerText 替换成 blueprint.slots 对应值)
//
// 设计要点:
//   - 严格契约:slot key 必须跟模板 data-slot 严格对应,不在模板里的 slot **静默忽略**
//     (warn log,不报错 — 兼容老 LLM 输出多余字段)
//   - LLM 100% 不能写 HTML/CSS — renderer 只用 cheerio API 改 innerText / 加 li 子元素
//   - 处理 4 种 slot type:text(默认) / list / rich / image-ref
//
// 跟现有 fillL1Template(slides-template-fill.ts:72)的关系:
//   - 旧 fillL1Template:让 LLM 改 HTML innerText(自由度大,可能改坏)
//   - 新 renderBlueprintSection:LLM 只输出 JSON,renderer 严格填(自由度零,品质 100% 锁定)
//   - Phase 1 PR32 会把 fillL1Template 重构成调用本 renderer

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { SlideBlueprint, SlotValue } from "./schema";

export interface RenderWarning {
  kind: "unknown_slot" | "missing_required" | "type_mismatch" | "over_length";
  slot: string;
  detail?: string;
}

export interface RenderResult {
  html: string;
  warnings: RenderWarning[];
}

/**
 * 把 blueprint.slots 填到 sectionHtml 的 data-slot 元素里,返回新 HTML。
 *
 * 实现策略:
 *   - 用 cheerio 加载 sectionHtml(不是整 deck,是单个 <section>)
 *   - 遍历每个 [data-slot] 元素,从 blueprint.slots 拿值,根据 data-slot-type 处理:
 *     - text:innerText 直接覆盖
 *     - list:期望 string[],先清空 children,再 append <li>×N
 *     - rich:期望含 **bold** / *italic* 的字符串,简单 markdown 解析后注入(MVP 阶段仅文本)
 *     - image-ref:期望 URL,设 src 或 background-image
 *   - 对照模板 slot 集合 vs blueprint slots 集合,记 warning(unknown / missing required)
 */
export function renderBlueprintSection(
  sectionHtml: string,
  blueprint: SlideBlueprint,
): RenderResult {
  const $ = cheerio.load(sectionHtml, { xml: false });
  const warnings: RenderWarning[] = [];
  const filledSlots = new Set<string>();

  // 遍历模板里所有 data-slot 元素,按 blueprint 填值
  $("[data-slot]").each((_, el) => {
    const $el = $(el);
    const slotName = $el.attr("data-slot") ?? "";
    const slotType = $el.attr("data-slot-type") ?? "text";
    const required = $el.attr("data-slot-required") === "true";
    const maxAttr = $el.attr("data-slot-max");
    const maxChars = maxAttr ? parseInt(maxAttr, 10) : null;
    const value = blueprint.slots[slotName];

    if (value === undefined || value === null) {
      if (required) {
        warnings.push({ kind: "missing_required", slot: slotName });
      }
      return; // 保留模板原 PLACEHOLDER 文字
    }

    filledSlots.add(slotName);
    fillSlot($el, slotName, slotType, value, maxChars, warnings);
  });

  // 检查 LLM 输出的 slot 是不是有不存在的(unknown)— warn 不报错,兼容 LLM 多输出
  const templateSlotNames = new Set<string>();
  $("[data-slot]").each((_, el) => {
    const name = $(el).attr("data-slot");
    if (name) templateSlotNames.add(name);
  });
  for (const slotName of Object.keys(blueprint.slots)) {
    if (!templateSlotNames.has(slotName)) {
      warnings.push({
        kind: "unknown_slot",
        slot: slotName,
        detail: `template has slots: ${Array.from(templateSlotNames).join(", ")}`,
      });
    }
  }

  return {
    html: $.html() ?? sectionHtml,
    warnings,
  };
}

/** 单个 slot 的填值逻辑 */
function fillSlot(
  $el: cheerio.Cheerio<AnyNode>,
  slotName: string,
  slotType: string,
  value: SlotValue,
  maxChars: number | null,
  warnings: RenderWarning[],
): void {
  switch (slotType) {
    case "list": {
      if (!Array.isArray(value)) {
        warnings.push({
          kind: "type_mismatch",
          slot: slotName,
          detail: `expected array, got ${typeof value}`,
        });
        return;
      }
      // 清空 + 加 <li>×N(假定模板用 <ul>/<ol> 包 <li>)
      $el.empty();
      for (const item of value) {
        const itemStr = String(item ?? "");
        if (maxChars && itemStr.length > maxChars) {
          warnings.push({ kind: "over_length", slot: slotName, detail: `${itemStr.length}/${maxChars}` });
        }
        // 直接 append 字符串避免 cheerio TS 复杂泛型
        const escaped = itemStr
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        $el.append(`<li>${escaped}</li>`);
      }
      break;
    }
    case "image-ref": {
      const url = typeof value === "string" ? value : String(value);
      if ($el.is("img")) {
        $el.attr("src", url);
      } else {
        // 设 inline background-image(保留原 style)
        const existing = $el.attr("style") ?? "";
        $el.attr("style", `${existing};background-image:url('${url}')`);
      }
      break;
    }
    case "rich":
    case "text":
    default: {
      const text = typeof value === "string" ? value : String(value);
      if (maxChars && text.length > maxChars) {
        warnings.push({ kind: "over_length", slot: slotName, detail: `${text.length}/${maxChars}` });
      }
      // rich 暂时按 text 处理,Phase 2 再加 markdown 解析
      $el.text(text);
      break;
    }
  }
}
