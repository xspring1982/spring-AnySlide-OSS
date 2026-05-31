// SPEC §2.4.3 — japanese_healing 日系治愈（stub）

import type { CardStyle } from "./types";

export const japanese_healing: CardStyle = {
  id: "japanese_healing",
  name: "日系治愈",

  viralIntensity: "medium",
  emojiPolicy: "sparse",

  preferredCompositions: [
    "stacked_cards",
    "horizontal_bands",
    "flower_petals",
    "cycle_loop",
    "central_radial",
    "mini_cards_stack",
  ],
  preferredCovers: ["hero_title", "centered_quote_seal"],
  avoidCompositions: [
    "magazine_cover",
    "sunburst",
    "game_map", // 调性不符
  ],

  preferredRatios: ["3:4", "4:5", "1:1"],
  defaultRatio: "3:4",

  promptBase: {
    // 实施方向：日系杂志风 / 柔和暖光 / 米色+水蓝+砖红 / 生活物件做装饰 / 手写感字体
    styleAdjectives:
      "TBD — direction: soft japanese magazine aesthetic, warm light, healing vibes",
    colorPalette:
      "TBD — direction: warm beige + soft sky blue + brick red + cream",
    composition: "TBD",
    texture: "TBD — direction: light film grain, soft focus areas",
    negativeCues: "TBD",
  },

  fonts: {
    heading: 'Noto Sans SC, "Hiragino Sans"',
    body: "Noto Sans SC",
    decorative: '"LXGW WenKai"',
  },


  status: "stub",
};
