// Phase 1 PR31:从模板 HTML 扫 data-slot 标记,生成 TemplateSlotSchema
//
// 模板设计师在 HTML 里加这种标记:
//   <h1 data-slot="title" data-slot-max="40">PLACEHOLDER</h1>
//   <ul data-slot="bullets" data-slot-type="list" data-slot-max="120">
//     <li>PLACEHOLDER</li>
//   </ul>
//
// 本工具扫整个模板 HTML,按 <section> 拆,每个 section 输出 TemplateSlotSchema。
// 输出会:
//   1. 喂给 LLM prompt(告诉 LLM "你能填的 slot 名 + 类型 + 长度限制")
//   2. 喂给 renderer(校验 LLM 输出 + 严格按 slot 填值)
//
// 设计要点:
//   - 不引外部 HTML parser 依赖(jsdom 太重),用现成的 cheerio(已在 deps)
//   - 跟 slides-template-fill.ts 的 parseDeckShell 一致风格(私有 cheerio + section 拆分)

import * as cheerio from "cheerio";
import type { TemplateSlotSchema, SlideBlueprint, SlotType } from "./schema";

const VALID_ROLES: SlideBlueprint["role"][] = [
  "cover",
  "agenda",
  "section_divider",
  "content",
  "closing",
];

function parseRole(raw: string | undefined): SlideBlueprint["role"] {
  if (raw && (VALID_ROLES as string[]).includes(raw)) {
    return raw as SlideBlueprint["role"];
  }
  return "content";
}

function parseSlotType(raw: string | undefined): SlotType {
  if (raw === "list" || raw === "rich" || raw === "image-ref") return raw;
  return "text";
}

/**
 * 从模板完整 HTML 扫所有 section + 每个 section 的 slot 契约。
 *
 * 模板 HTML 结构约定:
 *   <section data-section-role="cover">
 *     <h1 data-slot="title" data-slot-max="40">...</h1>
 *     <p data-slot="subtitle">...</p>
 *   </section>
 *   <section data-section-role="content">
 *     <ul data-slot="bullets" data-slot-type="list" data-slot-max="120">...</ul>
 *   </section>
 *
 * 返回每个 section 的 schema(供 LLM prompt + renderer 用)。
 */
export function extractTemplateSlots(templateHtml: string): TemplateSlotSchema[] {
  const $ = cheerio.load(templateHtml, { xml: false });
  const sections = $("section").toArray();
  const result: TemplateSlotSchema[] = [];

  sections.forEach((sec, i) => {
    const $sec = $(sec);
    const role = parseRole($sec.attr("data-section-role"));
    const slotEls = $sec.find("[data-slot]").toArray();

    const slots = slotEls.map((el) => {
      const $el = $(el);
      const name = $el.attr("data-slot") ?? "";
      const type = parseSlotType($el.attr("data-slot-type"));
      const maxAttr = $el.attr("data-slot-max");
      const max_chars = maxAttr ? parseInt(maxAttr, 10) : undefined;
      const required = $el.attr("data-slot-required") === "true";
      return {
        name,
        type,
        ...(max_chars && Number.isFinite(max_chars) ? { max_chars } : {}),
        ...(required ? { required } : {}),
      };
    });

    result.push({
      section_index: i + 1, // 1-based
      role,
      slots,
    });
  });

  return result;
}

/**
 * 把 TemplateSlotSchema 数组转成 LLM prompt 友好的描述(给 fillL1Template prompt 拼接)。
 *
 * 输出例:
 *   ## Section 1 (cover)
 *   - title (text, ≤40 字, 必填)
 *   - subtitle (text)
 *
 *   ## Section 2 (content)
 *   - title (text, ≤30 字)
 *   - bullets (list, ≤120 字/条)
 */
export function slotSchemasToPrompt(schemas: TemplateSlotSchema[]): string {
  return schemas
    .map((s) => {
      const slotLines = s.slots
        .map((sl) => {
          const parts: string[] = [sl.type];
          if (sl.max_chars) parts.push(`≤${sl.max_chars} 字`);
          if (sl.required) parts.push("必填");
          return `  - ${sl.name} (${parts.join(", ")})`;
        })
        .join("\n");
      return `## Section ${s.section_index} (${s.role})\n${slotLines || "  (无 slot)"}`;
    })
    .join("\n\n");
}
