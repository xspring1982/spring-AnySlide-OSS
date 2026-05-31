// SPEC §2.4.3 — ink_chinese 国风水墨（stub）

import type { CardStyle } from "./types";

export const ink_chinese: CardStyle = {
  id: "ink_chinese",
  name: "国风水墨",

  viralIntensity: "low", // 国风不该堆爆款词
  emojiPolicy: "none", // 严禁 emoji

  preferredCompositions: [
    "unrolled_scroll",
    "notebook_page",
    "pyramid_up",
    "central_radial",
    "iceberg",
    "tree",
  ],
  preferredCovers: ["centered_quote_seal", "magazine_cover"], // 中式杂志感
  avoidCompositions: [
    "phone_screen",
    "sticky_notes_wall",
    "sunburst",
    "game_map",
    "masonry_2col",
  ],

  preferredRatios: ["3:4", "4:5"],
  defaultRatio: "3:4",

  promptBase: {
    // 实施方向：水墨 / 朱红+墨黑+金色 / 宣纸质感 / 印章 + 毛笔书法 / 古典构图
    styleAdjectives:
      "TBD — direction: chinese ink wash, museum-grade, classical aesthetic",
    colorPalette:
      "TBD — direction: ink black + vermillion red + gold + indigo, on aged rice paper",
    composition: "TBD",
    texture: "TBD — direction: rice paper grain, ink wash bleed, vintage scroll feel",
    negativeCues:
      "TBD — must NOT include: emoji, modern sans-serif fonts, neon colors",
  },

  fonts: {
    heading: '"Noto Serif SC", "Source Han Serif"',
    body: '"Noto Serif SC"',
    decorative: '"LXGW WenKai", "STKaiti"', // 楷体 / 霞鹜文楷做装饰
  },


  status: "stub",
};
