// SPEC §3.3.4 — academic_serif 学术衬线(stub)

import type { SlideStyle } from "./types";

export const academic_serif: SlideStyle = {
  id: "academic_serif",
  name: "学术衬线",
  emoji: "📚",
  oneLineDesc: "白底 + 衬线 + drop caps + pull quotes",
  supports: ["L1", "L2"],

  colors: {
    primary: "#c41e3a", // 朱红
    secondary: "#1a1a1a", // 炭黑
    accent: "#c41e3a",
    bg: "#faf9f7", // 米白
    text: "#1a1a1a",
    textSecondary: "#5a5a5a",
  },

  fonts: {
    heading: '"Cormorant Garamond", "Noto Serif SC", serif',
    body: '"Source Serif 4", "Noto Serif SC", serif',
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
    config: { tint: "#faf9f7" },
  },

  emojiPolicy: "none",

  l2PromptBase: {
    styleAdjectives:
      "TBD — direction: academic editorial, paper-and-ink aesthetic, drop caps + pull quotes",
    colorPalette: "TBD — direction: cream paper #faf9f7 + charcoal text + brand red #c41e3a",
    composition: "TBD",
    texture: "TBD — direction: subtle paper grain, vintage letterpress feel",
    negativeCues: "TBD",
  },

  defaultRatio: "16:9",
  status: "stub",
};
