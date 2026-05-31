// SPEC §2.4.3 — vintage_magazine 复古杂志（stub）

import type { CardStyle } from "./types";

export const vintage_magazine: CardStyle = {
  id: "vintage_magazine",
  name: "复古杂志",

  viralIntensity: "high",
  emojiPolicy: "none", // 杂志风不用 emoji

  preferredCompositions: [
    "horizontal_bands",
    "masonry_2col",
    "split_top_bottom",
    "split_left_right",
    "pyramid_up",
    "phone_screen",
  ],
  preferredCovers: ["magazine_cover", "bold_headline"],
  avoidCompositions: [
    "unrolled_scroll",
    "sticky_notes_wall",
    "sunburst",
    "flower_petals",
  ],

  preferredRatios: ["4:5", "3:2"],
  defaultRatio: "4:5",

  promptBase: {
    // 实施方向：editorial / NYT 风 / 衬线大标题 + 无衬线正文 / 米色纸张 + 黑红配色 / 印刷颗粒感
    styleAdjectives:
      "TBD — direction: editorial magazine, NYT-style, retro print",
    colorPalette:
      "TBD — direction: cream paper + black + 1 brand red (#B33A3A)",
    composition: "TBD",
    texture:
      "TBD — direction: print grain, slight CMYK misalignment, paper feel",
    negativeCues: "TBD",
  },

  fonts: {
    heading: '"Noto Serif SC", Georgia',
    body: "Noto Sans SC",
  },


  status: "stub",
};
