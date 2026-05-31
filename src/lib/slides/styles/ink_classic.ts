// SPEC §3.3.4 — ink_classic 墨水经典(stub,可直接 fork guizang Monocle CSS)

import type { SlideStyle } from "./types";

export const ink_classic: SlideStyle = {
  id: "ink_classic",
  name: "墨水经典",
  emoji: "🖋",
  oneLineDesc: "纯黑墨 + 暖白纸(杂志风)",
  supports: ["L1", "L2"],

  colors: {
    primary: "#0a0a0b", // 纯黑墨
    secondary: "#0a0a0b",
    accent: "#7a3a2a", // 暖棕
    bg: "#f1efea", // 暖白
    text: "#0a0a0b",
    textSecondary: "#5a5a5a",
  },

  fonts: {
    heading: '"Noto Serif SC", "GT Sectra", "Times New Roman", serif',
    body: '"Noto Serif SC", Georgia, serif',
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
    type: "paper_texture",
    config: { tint: "#f1efea" },
  },

  emojiPolicy: "none",

  l2PromptBase: {
    styleAdjectives:
      "TBD — direction: ink-on-warm-paper magazine aesthetic, classic editorial",
    colorPalette: "TBD — direction: jet black ink #0a0a0b on warm cream #f1efea paper",
    composition: "TBD",
    texture: "TBD — direction: warm paper texture, vintage magazine feel",
    negativeCues: "TBD",
  },

  defaultRatio: "16:9",
  status: "stub",
};
