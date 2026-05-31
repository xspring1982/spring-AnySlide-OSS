// Slides 6 风格 — SPEC §3.3.2 定型
//
// 注意：与 cards 一样，这里只放 picker UI 元数据。完整 schema（colors / fonts / scale /
// compatibleLayouts / l2PromptBase）在 P0-3 拆到 src/lib/styles/slides/{id}.ts。
//
// 状态：modern_pro 是 SPEC §3.3.3 唯一 complete 的；其余 5 个 stub。
// 顺序：SPEC §3.3.2 表里的预估使用频率，首位 modern_pro 是默认。

export type SlideStyleId =
  | "modern_pro"
  | "elegant_dark"
  | "academic_serif"
  | "ink_classic"
  | "pink_girl"
  | "swiss_grid";

export type SlideRatio = "16:9" | "4:3" | "1:1";

export interface SlideStyleMeta {
  id: SlideStyleId;
  name: string;
  emoji: string;
  oneLineDesc: string;
  swatch: string;
  defaultRatio: SlideRatio;
  /** L1（HTML）/ L2（AI 全屏 PPTX）双轨支持，详 §3.2 */
  supports: ("L1" | "L2")[];
  status: "complete" | "stub";
}

export const SLIDE_STYLES: SlideStyleMeta[] = [
  {
    id: "modern_pro",
    name: "现代专业",
    emoji: "🎯",
    oneLineDesc: "深背景 + 橙焦点 · 路演 / 汇报通用",
    // SPEC §3.3.3：primary #FF5722 / bg #0d0d0d→#2d2d2d / accent #FF8A65
    swatch:
      "linear-gradient(135deg, #0d0d0d 0%, #2d2d2d 55%, #FF5722 90%, #FF8A65 100%)",
    defaultRatio: "16:9",
    supports: ["L1", "L2"],
    status: "complete",
  },
  {
    id: "elegant_dark",
    name: "优雅暗纹",
    emoji: "🌑",
    oneLineDesc: "深底 + 金粉点缀 + 衬线",
    swatch:
      "linear-gradient(135deg, #1B1A24 0%, #2C2233 50%, #B8915A 90%, #E6CFA0 100%)",
    defaultRatio: "16:9",
    supports: ["L1", "L2"],
    status: "stub",
  },
  {
    id: "academic_serif",
    name: "学术衬线",
    emoji: "📚",
    oneLineDesc: "白底 + 衬线 + drop caps + pull quotes",
    swatch:
      "linear-gradient(135deg, #FAF7F0 0%, #F0EBE0 50%, #6B5D4A 90%, #2D2419 100%)",
    defaultRatio: "16:9",
    supports: ["L1", "L2"],
    status: "stub",
  },
  {
    id: "ink_classic",
    name: "墨水经典",
    emoji: "🖋",
    oneLineDesc: "纯黑墨 + 暖白纸（杂志风）",
    swatch:
      "linear-gradient(135deg, #FBF7EE 0%, #EFE4CC 50%, #1A1916 90%, #000000 100%)",
    defaultRatio: "16:9",
    supports: ["L1", "L2"],
    status: "stub",
  },
  {
    id: "pink_girl",
    name: "粉色少女",
    emoji: "🎀",
    oneLineDesc: "桃粉 + 薰衣草 + 玩味徽章",
    swatch:
      "linear-gradient(135deg, #FFE4EC 0%, #F8C4D4 40%, #C9A6E0 75%, #6B4D8A 100%)",
    defaultRatio: "16:9",
    supports: ["L1", "L2"],
    status: "stub",
  },
  {
    id: "swiss_grid",
    name: "瑞士网格",
    emoji: "🔲",
    oneLineDesc: "强对齐 + 红黑 + 不对称版式",
    swatch:
      "linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 55%, #1A1A1A 80%, #E63946 100%)",
    defaultRatio: "16:9",
    supports: ["L1", "L2"],
    status: "stub",
  },
];

export const DEFAULT_SLIDE_STYLE: SlideStyleId = "modern_pro";

export function findSlideStyle(id: string): SlideStyleMeta | undefined {
  return SLIDE_STYLES.find((s) => s.id === id);
}
