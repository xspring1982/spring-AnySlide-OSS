// SPEC §3.3.4 — swiss_grid 瑞士网格(stub)

import type { SlideStyle } from "./types";

export const swiss_grid: SlideStyle = {
  id: "swiss_grid",
  name: "瑞士网格",
  emoji: "🔲",
  oneLineDesc: "强对齐 + 红黑 + 不对称",
  supports: ["L1", "L2"],

  colors: {
    primary: "#ff3300", // 红
    secondary: "#000000", // 黑
    accent: "#ff3300",
    bg: "#ffffff",
    text: "#000000",
    textSecondary: "#666666",
  },

  fonts: {
    heading: '"Archivo", "Noto Sans SC", system-ui, sans-serif',
    body: '"Nunito", "Noto Sans SC", system-ui, sans-serif',
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
    type: "grid_lines",
    config: { color: "#eeeeee", spacing: "24px" },
  },

  emojiPolicy: "none",

  l2PromptBase: {
    styleAdjectives:
      "TBD — direction: Swiss International Style, strong grid alignment, asymmetric red-black",
    colorPalette: "TBD — direction: pure white + jet black + brand red #ff3300",
    composition: "TBD",
    texture: "TBD — direction: clean modernist, visible grid system",
    negativeCues: "TBD",
  },

  defaultRatio: "16:9",
  status: "stub",
};
