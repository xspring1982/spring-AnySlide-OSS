// SPEC §2.4.3 — minimal_whitespace 极简留白（stub）
//
// 状态：schema 已定，promptBase 待 P0-3 实测时填（每个风格须跑 4 张实测）。

import type { CardStyle } from "./types";

export const minimal_whitespace: CardStyle = {
  id: "minimal_whitespace",
  name: "极简留白",

  viralIntensity: "low",
  emojiPolicy: "none",

  preferredCompositions: [
    "split_top_bottom",
    "split_left_right",
    "iceberg",
    "concentric_target",
    "stacked_cards", // 但要稀疏
  ],
  preferredCovers: ["hero_title", "bold_headline"],
  avoidCompositions: [
    "sticky_notes_wall",
    "sunburst",
    "flower_petals", // 信息太密
    "unrolled_scroll",
    "magazine_cover",
    "game_map",
  ],

  preferredRatios: ["3:4", "1:1"],
  defaultRatio: "3:4",

  promptBase: {
    // 实施方向：60%+ 留白 / 仅 1 标题 + 1 副标题 / 黑白灰 + 1 点缀色 / 几何元素 / 瑞士网格
    styleAdjectives:
      "TBD — direction: extreme minimalism, swiss grid, generous negative space",
    colorPalette:
      "TBD — direction: black + white + 1 accent (e.g., #C96B35 only)",
    composition: "TBD",
    texture: "TBD — direction: completely flat, no texture, pure surfaces",
    negativeCues: "TBD",
  },

  fonts: {
    heading: 'Noto Sans SC, "Helvetica Neue"',
    body: 'Noto Sans SC, "Helvetica Neue"',
  },


  status: "stub",
};
