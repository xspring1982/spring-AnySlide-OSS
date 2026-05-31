// SPEC §3.3.4 — pink_girl 粉色少女(stub)

import type { SlideStyle } from "./types";

export const pink_girl: SlideStyle = {
  id: "pink_girl",
  name: "粉色少女",
  emoji: "🎀",
  oneLineDesc: "桃粉 + 薰衣草 + 玩味徽章",
  supports: ["L1", "L2"],

  colors: {
    primary: "#f5a8c1", // 桃粉
    secondary: "#e4dff0", // 薰衣草
    accent: "#9bd5b9", // 薄荷
    bg: "#f5e6dc",
    text: "#3a2a3f",
    textSecondary: "#6a5a70",
  },

  fonts: {
    heading: '"Outfit", "Noto Sans SC", system-ui, sans-serif',
    body: '"Outfit", "Noto Sans SC", system-ui, sans-serif',
  },

  scale: { h1: 4.5, h2: 2.5, h3: 1.6, body: 1.0, caption: 0.85 },

  compatibleLayouts: [
    "hero-cover",
    "act-divider",
    "big-numbers-grid",
    "quote-image",
    "image-grid",
    "pipeline",
    "hero-question",
    "big-quote",
    "before-after",
    "lead-image-side-text",
  ],

  defaultBackground: {
    type: "gradient",
    config: { from: "#f5e6dc", to: "#e4dff0", angle: 180 },
  },

  emojiPolicy: "rich",

  l2PromptBase: {
    styleAdjectives:
      "TBD — direction: split pastel girlhood aesthetic, playful badges, peach + lavender + mint",
    colorPalette: "TBD — direction: peach pink + lavender + mint accents, soft pastels",
    composition: "TBD",
    texture: "TBD — direction: soft pastel paper, playful collage feel",
    negativeCues: "TBD",
  },

  defaultRatio: "16:9",
  status: "stub",
};
