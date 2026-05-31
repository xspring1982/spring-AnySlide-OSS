// SPEC §2.4.2 — xiaohongshu_fresh 小红书清新（完整样板 ✅）

import type { CardStyle } from "./types";

export const xiaohongshu_fresh: CardStyle = {
  id: "xiaohongshu_fresh",
  name: "小红书清新",

  viralIntensity: "high",
  emojiPolicy: "sparse", // 封面 1-2 个，正文克制

  preferredCompositions: [
    "stacked_cards", // 通用要点
    "horizontal_bands", // 多要点并列
    "split_left_right", // 对比
    "mini_cards_stack", // 干货堆叠
    "flower_petals", // 围绕展开
    "sticky_notes_wall", // 多点散布
    "staircase", // 步骤进阶
  ],
  preferredCovers: ["hero_title", "bold_headline"],
  avoidCompositions: [
    "unrolled_scroll", // 国风专属，不搭
    "magazine_cover", // 复古杂志专属
    "phone_screen", // 太具象，限制内容
  ],

  preferredRatios: ["3:4", "4:5", "9:16"],
  defaultRatio: "3:4",

  promptBase: {
    styleAdjectives:
      "fresh, airy, gentle small-red-book aesthetic; soft natural lighting; " +
      "cozy lifestyle vibes; instagram-worthy editorial feel",
    colorPalette:
      "muted pastels (warm beige #F5EBDD, sage green #B5C4A8, " +
      "clay terracotta #C96B35, soft cream #FFF8EE); avoid saturated primaries",
    composition:
      "rule-of-thirds; generous whitespace 30%+; eye-level angle; " +
      "shallow depth of field for product/object shots; centered focal point",
    texture:
      "matte paper feel; subtle paper grain; very mild film noise OK; " +
      "occasional washi tape or sticker accents (sparingly)",
    negativeCues:
      "NO AI slop / NO purple gradients / NO Inter font / NO Roboto / " +
      "NO generic stock-photo lighting / NO glossy plastic / " +
      "NO hyper-saturated colors / NO 3D rendering style",
  },

  fonts: {
    heading: 'Noto Sans SC, "PingFang SC", system-ui',
    body: 'Noto Sans SC, "PingFang SC", system-ui',
    decorative: '"LXGW WenKai", serif', // 霞鹜文楷做点缀（标语 / 引言）
  },


  status: "complete",
};
