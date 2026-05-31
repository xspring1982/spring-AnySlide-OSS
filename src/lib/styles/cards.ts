// Cards 6 风格 — SPEC §2.4 定型
//
// 注意：这里只放 UI picker 需要的元数据（id / name / emoji / swatch / defaultRatio）。
// 完整 schema（promptBase / preferredCompositions / fonts 等）在 P0-3 实测填充时
// 拆到 src/lib/styles/cards/{id}.ts，这里 re-export。
//
// 状态：xiaohongshu_fresh 是 SPEC §2.4.2 唯一 complete 的；其余 5 个 stub。

export type CardStyleId =
  | "xiaohongshu_fresh"
  | "minimal_whitespace"
  | "japanese_healing"
  | "vintage_magazine"
  | "thick_paint_illustration"
  | "ink_chinese";

export type CardRatio = "3:4" | "4:5" | "1:1" | "9:16";

export interface CardStyleMeta {
  id: CardStyleId;
  name: string;            // 中文显示名
  emoji: string;
  oneLineDesc: string;     // chip hover 描述
  swatch: string;          // CSS background（color/gradient）— picker 缩略
  defaultRatio: CardRatio; // SPEC defaultRatio
  status: "complete" | "stub";
}

/** SPEC §2.4 — 6 个 cards 风格，按预估使用频率排序，首位是默认 */
export const CARD_STYLES: CardStyleMeta[] = [
  {
    id: "xiaohongshu_fresh",
    name: "小红书清新",
    emoji: "🌿",
    oneLineDesc: "muted pastel · 柔和留白 · IG 杂志感",
    // SPEC §2.4.2 真实色板：warm beige #F5EBDD + sage green #B5C4A8 + clay terracotta #C96B35 + soft cream #FFF8EE
    swatch:
      "linear-gradient(135deg, #FFF8EE 0%, #F5EBDD 35%, #B5C4A8 70%, #C96B35 100%)",
    defaultRatio: "3:4",
    status: "complete",
  },
  {
    id: "minimal_whitespace",
    name: "极简留白",
    emoji: "⬜",
    oneLineDesc: "60%+ 留白 · 黑白灰 + 1 点缀 · 瑞士网格",
    // SPEC §2.4.3：black + white + 1 accent (e.g., #C96B35 only)
    swatch:
      "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 60%, #1A1A1A 60%, #1A1A1A 88%, #C96B35 88%)",
    defaultRatio: "3:4",
    status: "stub",
  },
  {
    id: "japanese_healing",
    name: "日系治愈",
    emoji: "🍃",
    oneLineDesc: "暖米 + 水蓝 + 砖红 · 柔和暖光",
    // SPEC §2.4.3 实施方向：warm beige + soft sky blue + brick red + cream
    swatch:
      "linear-gradient(135deg, #FFF8EE 0%, #E8D9C2 30%, #B8D4DA 65%, #C5614C 100%)",
    defaultRatio: "3:4",
    status: "stub",
  },
  {
    id: "vintage_magazine",
    name: "复古杂志",
    emoji: "📰",
    oneLineDesc: "做旧纸张 + 衬线 + 编辑感版式",
    swatch:
      "linear-gradient(135deg, #F2E8D5 0%, #D4B896 40%, #6B4226 80%, #2A1810 100%)",
    defaultRatio: "3:4",
    status: "stub",
  },
  {
    id: "thick_paint_illustration",
    name: "厚涂插画",
    emoji: "🎨",
    oneLineDesc: "笔触明显 · 高饱和 · 油画感",
    swatch:
      "linear-gradient(135deg, #F4A261 0%, #E76F51 30%, #2A9D8F 65%, #264653 100%)",
    defaultRatio: "3:4",
    status: "stub",
  },
  {
    id: "ink_chinese",
    name: "国风水墨",
    emoji: "🖌",
    oneLineDesc: "宣纸 · 飞白 · 朱砂印章",
    swatch:
      "linear-gradient(135deg, #F4ECD8 0%, #C9B49C 35%, #5C2510 75%, #2B1205 100%)",
    defaultRatio: "3:4",
    status: "stub",
  },
];

export const DEFAULT_CARD_STYLE: CardStyleId = "xiaohongshu_fresh";

export function findCardStyle(id: string): CardStyleMeta | undefined {
  return CARD_STYLES.find((s) => s.id === id);
}
