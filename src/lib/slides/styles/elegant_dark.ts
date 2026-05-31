// SPEC §3.3.4 — elegant_dark 优雅暗纹(stub,P0-3 实施时填 l2PromptBase)

import type { SlideStyle } from "./types";

export const elegant_dark: SlideStyle = {
  id: "elegant_dark",
  name: "优雅暗纹",
  emoji: "🌑",
  oneLineDesc: "深色 + 金粉点缀 + 衬线",
  supports: ["L1", "L2"],

  colors: {
    primary: "#c9b896", // 暖金粉
    secondary: "#0f0f0f", // 近黑
    accent: "#e8b4b8", // 玫瑰粉
    bg: "#0f0f0f",
    text: "#ffffff",
    textSecondary: "#888888",
  },

  fonts: {
    heading: '"Cormorant Garamond", "Noto Serif SC", serif',
    body: '"IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif',
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
    config: { from: "#0f0f0f", to: "#1a1816", angle: 180 },
  },

  emojiPolicy: "none",

  l2PromptBase: {
    styleAdjectives:
      "TBD — direction: elegant dark editorial, refined sophistication, gold-pink subtle accents",
    colorPalette: "TBD — direction: near-black + warm gold #c9b896 + rose #e8b4b8 highlights",
    composition: "TBD",
    texture: "TBD — direction: subtle paper grain, soft botanical motifs",
    negativeCues: "TBD",
  },

  defaultRatio: "16:9",
  status: "stub",
};
