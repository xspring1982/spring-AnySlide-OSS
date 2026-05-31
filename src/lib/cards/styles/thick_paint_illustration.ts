// SPEC §2.4.3 — thick_paint_illustration 厚涂插画（stub）

import type { CardStyle } from "./types";

export const thick_paint_illustration: CardStyle = {
  id: "thick_paint_illustration",
  name: "厚涂插画",

  viralIntensity: "medium",
  emojiPolicy: "none", // 插画自带视觉，不堆 emoji

  preferredCompositions: [
    "mountain_climb",
    "growth_tree",
    "river_confluence",
    "central_radial",
    "flower_petals",
    "unrolled_scroll",
  ],
  preferredCovers: ["centered_quote_seal", "hero_title"],
  avoidCompositions: [
    "phone_screen",
    "sticky_notes_wall", // 太具象 / 太碎
    "masonry_2col",
  ],

  preferredRatios: ["3:4", "4:5"],
  defaultRatio: "3:4",

  promptBase: {
    // 实施方向：吉卜力 / 油画质感 / 浓厚色彩 / 笔触可见 / 自然元素强
    styleAdjectives:
      "TBD — direction: thick painted illustration, ghibli-inspired, oil-painting texture",
    colorPalette: "TBD — direction: rich earth tones + sky / forest palette",
    composition: "TBD",
    texture: "TBD — direction: visible brush strokes, painterly, hand-crafted",
    negativeCues: "TBD",
  },

  fonts: {
    heading: '"Noto Serif SC"',
    body: "Noto Sans SC",
    decorative: '"LXGW WenKai"',
  },


  status: "stub",
};
