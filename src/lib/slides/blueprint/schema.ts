// Phase 1 PR31:JSON Blueprint Schema(对标 AnyGen 的 Lark sml/2.0 block 模型)
//
// 设计目标:
//   1. LLM **只输出 JSON Blueprint**(不输出 HTML / CSS),100% 杜绝 LLM 改坏视觉
//   2. 同一份 Blueprint 可以渲染到多种格式:HTML(浏览器)/ PPTX(pptxgenjs)/ PDF
//   3. 给模板设计师明确的"插槽契约"(data-slot 标记),renderer 严格按契约填
//
// 跟现有 SlideEntry(types.ts:22)的关系:
//   - SlideEntry 仍是 outline 阶段的中间表示(LLM analyze 输出)
//   - SlideBlueprint 是更精细的 per-slide schema,加了 slots 字段(对标 AnyGen 的 data-zone-id)
//   - Phase 1 PR32 会重构 fillL1Template:不再让 LLM 改 HTML innerText,
//     而是让 LLM 输出 slots,renderer 按 data-slot 填入模板
//
// 跟 AnyGen 的 block schema 对照:
//   AnyGen: data-block-type="slide" + data-record-id="cover" + data-zone-id="title#placeholder"
//   我们:   role="cover"            + slots: { title: "Q2 复盘" }     + data-slot="title"

import type { Locale } from "@/i18n/routing";

/** 单个 slot 的值(MVP 阶段只支持纯文本,后续 Phase 可加 markdown/list/image) */
export type SlotValue = string | string[];

/** Improve / schema-first renderer 用的稳定版式意图 */
export type SlideLayoutIntent =
  | "cover"
  | "agenda"
  | "single_text"
  | "bullets"
  | "big_number"
  | "comparison"
  | "timeline"
  | "quote"
  | "two_column"
  | "section_divider"
  | "closing";

/** 单页蓝图 — LLM 在 fillL1Template 阶段输出这个,renderer 用它填模板 */
export interface SlideBlueprint {
  /** 1-based 全局序号 */
  page_no: number;

  /** 对应模板的哪个 section(L1 模板有 N 个 section,1-based)*/
  template_section_index: number;

  /** SPEC §3.5.1 一致的 5 种角色 */
  role: "cover" | "agenda" | "section_divider" | "content" | "closing";

  /**
   * 确定性 renderer 的版式选择信号。
   * 这一步对齐 Presenton 的 structure → layout selection:LLM 只选意图,
   * 不直接改 PPTX 坐标 / CSS;渲染器按固定模板输出稳定版式。
   */
  layout_intent?: SlideLayoutIntent;

  /**
   * 槽位填充表 — 跟模板 HTML 里 `data-slot="xxx"` 严格对应。
   * 模板里有多少个 data-slot 标记,这里就要填多少个 key。
   *
   * 例:模板 cover.html 里有:
   *   <h1 data-slot="title">PLACEHOLDER</h1>
   *   <p data-slot="subtitle">PLACEHOLDER</p>
   *   <ul data-slot="bullets" data-slot-type="list">...</ul>
   *
   * Blueprint slots 必须是:
   *   { title: "...", subtitle: "...", bullets: ["a", "b", "c"] }
   *
   * LLM 在 prompt 里会被告知"模板有这些 slot,给我填这些 key"。
   * Renderer 严格校验:slot key 不在模板里 → warn;模板有 slot 但 blueprint 没填 → 保留 PLACEHOLDER。
   */
  slots: Record<string, SlotValue>;

  /** 演讲者备注(可选,导出 PPTX 时用 native notes,导出 HTML 时藏在 <details>)*/
  speaker_notes?: string;
}

/** Deck 级 metadata(整份 deck 的设置) */
export interface DeckBlueprintMeta {
  title: string;
  /** 用户原 prompt / 主题 */
  topic: string;
  /** 锁定的模板 id(对应 templates.id,如 "l1-guizang-monocle") */
  template_id: string;
  /** 输出语言 */
  locale: Locale;
  /** 比例 — 现阶段固定 16:9,Phase 2 后可扩展 */
  ratio: "16:9" | "9:16" | "4:3";
  /**
   * Phase 5:模板继承 — 用户上传 PPT 时自动提取的 theme
   * blueprintToPptx 会优先用这里的色 / 字 override 默认风格
   */
  inheritedTheme?: {
    colors?: {
      bg?: string; // 通常 dk1/lt1 二选一
      text?: string;
      accent?: string; // 主推色,通常 accent1
      muted?: string; // 次文字色
    };
    fonts?: {
      heading?: string;
      body?: string;
    };
    /** 主题名(展示用) */
    name?: string;
  };
}

/** 整份 deck 的 blueprint(顶层结构,跨多页) */
export interface DeckBlueprint {
  meta: DeckBlueprintMeta;
  slides: SlideBlueprint[];
}

/**
 * Slot 类型注释(给 renderer 用)
 * 模板可以在 HTML 里用 `data-slot-type` 标注 slot 期望的值类型,renderer 据此处理:
 *   - "text" (默认):innerText 直接覆盖
 *   - "list":期望 string[],renderer 渲染成 <li> 列表
 *   - "rich":期望含简单 markdown(**bold** / *italic*),renderer 解析
 *   - "image-ref":期望 image URL,renderer 设 src 或 background-image
 */
export type SlotType = "text" | "list" | "rich" | "image-ref";

/** 模板 slot 契约(从模板 HTML 扫出来,renderer + LLM prompt 都用)*/
export interface TemplateSlotSchema {
  /** 模板 section 序号(跟 template_outline 对应)*/
  section_index: number;
  /** 该 section 用什么 role(cover/content/closing 等)*/
  role: SlideBlueprint["role"];
  /** 该 section 暴露的 slots */
  slots: Array<{
    name: string;
    type: SlotType;
    /** 字符长度建议(给 LLM prompt 用,防止文字爆版面)*/
    max_chars?: number;
    /** 是否必填(模板里有 data-slot-required="true" 标记)*/
    required?: boolean;
  }>;
}

/** Blueprint 解析错误(给 LLM 重试 / onFailure 退款用) */
export type BlueprintParseError =
  | { kind: "non_json"; raw: string }
  | { kind: "missing_field"; path: string }
  | { kind: "slot_key_unknown"; slot: string; available: string[] }
  | { kind: "slot_type_mismatch"; slot: string; expected: SlotType; got: string }
  | { kind: "bad_page_no"; got: unknown };

/** 类型守卫:运行时校验 LLM 返回是不是合法 SlideBlueprint */
export function isSlideBlueprint(x: unknown): x is SlideBlueprint {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.page_no === "number" &&
    typeof o.template_section_index === "number" &&
    typeof o.role === "string" &&
    !!o.slots &&
    typeof o.slots === "object"
  );
}
