// SPEC §3.3.3 — modern_pro 现代专业(完整样板 ✅)

import type { SlideStyle } from "./types";

export const modern_pro: SlideStyle = {
  id: "modern_pro",
  name: "现代专业",
  emoji: "🎯",
  oneLineDesc: "大胆现代 + 橙色焦点卡,路演与汇报通用,深色背景",
  supports: ["L1", "L2"],

  colors: {
    primary: "#FF5722",
    secondary: "#1a1a1a",
    accent: "#FF8A65",
    bg: "#0d0d0d",
    text: "#ffffff",
    textSecondary: "#a0a0a0",
  },

  fonts: {
    heading: '"Archivo Black", "Noto Sans SC", system-ui, sans-serif',
    body: '"Space Grotesk", "Noto Sans SC", system-ui, sans-serif',
  },

  scale: {
    h1: 4.5,
    h2: 2.5,
    h3: 1.6,
    body: 1.0,
    caption: 0.85,
  },

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
    config: { from: "#1a1a1a", to: "#2d2d2d", angle: 135 },
  },

  emojiPolicy: "sparse",

  l2PromptBase: {
    styleAdjectives:
      "bold, modern, high-impact corporate aesthetic; confident typography; " +
      "dark gradient background with vibrant orange focal accent",
    colorPalette:
      "near-black gradient #1a1a1a→#2d2d2d background; " +
      "orange focal card #FF5722; pure white headline text; muted gray subtext",
    composition:
      "asymmetric; section number top-left; navigation top-right; " +
      "main title bottom-left; one bold focal element per slide",
    texture:
      "matte digital surface; very mild grain OK; no glossy effects; clean edges",
    negativeCues:
      "no purple gradients, no AI slop, no neon glow, no soft pastels, no skeuomorphism",
  },

  defaultRatio: "16:9",
  status: "complete",
};
