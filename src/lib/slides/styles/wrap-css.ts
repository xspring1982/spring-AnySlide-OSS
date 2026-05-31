// SPEC §3.4 — L1 HTML iframe 包装器的"按风格生成 base CSS"工厂
//
// 旧实现:wrapHtml() 注入一段写死的通用 CSS,所有风格视觉都长一样
// 新实现:每个风格生成自己一套 CSS(色 / 字 / 排版 / 装饰),slide HTML 真的吃风格 token
//
// 风格作者添加新风格的步骤:
//   1. 在 src/lib/slides/styles/<id>.ts 写完整 SlideStyle 定义
//   2. (可选)在 STYLE_DECORATIONS 添加该风格的装饰 CSS 增强
//   3. 自动 work — 不需要再改 wrap-css.ts

import type { SlideStyle } from "./types";

/**
 * 生成 iframe 内的完整 base CSS — 6 风格通吃
 * 关键:用 CSS 变量把 style token 注入,base class 用 var() 引用
 */
export function buildBaseCss(style: SlideStyle, ratio: string): string {
  const c = style.colors;
  const f = style.fonts;
  const s = style.scale;
  // 把 ratio 转成 aspect-ratio CSS 值(16:9 → 16 / 9)
  const aspectRatio = ratio.replace(":", " / ");

  // 主背景:支持 solid 和 gradient
  let bgValue = c.bg;
  if (style.defaultBackground?.type === "gradient") {
    const cfg = style.defaultBackground.config as
      | { from?: string; to?: string; angle?: number }
      | undefined;
    if (cfg?.from && cfg?.to) {
      bgValue = `linear-gradient(${cfg.angle ?? 135}deg, ${cfg.from}, ${cfg.to})`;
    }
  }

  return `
:root {
  --c-primary:    ${c.primary};
  --c-secondary:  ${c.secondary};
  --c-accent:     ${c.accent};
  --c-bg:         ${c.bg};
  --c-text:       ${c.text};
  --c-text-2:     ${c.textSecondary};
  --f-heading:    ${f.heading};
  --f-body:       ${f.body};
  --scale-h1:     ${s.h1};
  --scale-h2:     ${s.h2};
  --scale-h3:     ${s.h3};
  --scale-body:   ${s.body};
  --scale-cap:    ${s.caption};
  --aspect:       ${aspectRatio};
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 100%;
  height: 100%;
  background: ${bgValue};
  color: var(--c-text);
  font-family: var(--f-body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

body {
  padding: 5vh 6vw;
  display: flex;
  flex-direction: column;
}

/* ─ Typography ─────────────────────────────────────── */

h1, h2, h3 {
  font-family: var(--f-heading);
  color: var(--c-text);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.h-hero {
  font-size: calc(var(--scale-h1) * 1rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--c-text);
}
.h-xl   { font-size: calc(var(--scale-h2) * 1rem); }
.h-md   { font-size: calc(var(--scale-h3) * 1rem); }
.h-sub  {
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--c-text-2);
  margin-top: 1rem;
  line-height: 1.4;
}

p, li {
  font-size: calc(var(--scale-body) * 1rem);
  color: var(--c-text);
}

.kicker {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--c-accent);
  font-weight: 700;
  margin-bottom: 1rem;
  display: inline-block;
}

.lead {
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--c-text-2);
  margin: 0.75rem 0;
}

.callout {
  font-size: 1.15rem;
  font-weight: 600;
  font-style: normal;
  padding: 1.25rem 1.5rem;
  border-left: 4px solid var(--c-accent);
  background: color-mix(in srgb, var(--c-accent) 8%, transparent);
  border-radius: 0 12px 12px 0;
  color: var(--c-text);
  margin: 1.5rem 0;
}

ul, ol {
  padding-left: 1.5em;
  margin: 1rem 0;
}
li {
  margin-bottom: 0.6rem;
  line-height: 1.6;
}
li::marker { color: var(--c-accent); }

strong, b {
  color: var(--c-accent);
  font-weight: 700;
}

a { color: var(--c-accent); }

/* ─ Layout grid utilities ──────────────────────────── */

.grid-2-7-5 { display: grid; grid-template-columns: 7fr 5fr; gap: 4vw; align-items: stretch; flex: 1; }
.grid-2-6-6 { display: grid; grid-template-columns: 1fr 1fr;  gap: 4vw; align-items: stretch; flex: 1; }
.grid-2-8-4 { display: grid; grid-template-columns: 8fr 4fr; gap: 4vw; align-items: stretch; flex: 1; }
.grid-2-5-7 { display: grid; grid-template-columns: 5fr 7fr; gap: 4vw; align-items: stretch; flex: 1; }
.grid-3     { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2vw; flex: 1; }
.grid-3-3   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2vw; align-items: stretch; flex: 1; }
.grid-4     { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5vw; flex: 1; }
.grid-6     { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2vw; flex: 1; }

/* hero-cover layout: 居中超大标题 */
[class*="display:grid"] {
  display: grid;
}

/* ─ 通用辅助 cards / steps / numbers ─────────────── */

.stat-card,
.step-card,
.left-column,
.right-column {
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  padding: 2rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.big-number {
  font-family: var(--f-heading);
  font-size: calc(var(--scale-h1) * 0.7rem);
  font-weight: 900;
  color: var(--c-accent);
  line-height: 1;
  letter-spacing: -0.04em;
}

.image-container,
.image-wrapper,
.visual-placeholder {
  background: color-mix(in srgb, var(--c-accent) 12%, transparent);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  min-height: 30vh;
  text-align: center;
}
.visual-hint, .visual-placeholder, .emoji-icon {
  font-size: 4rem;
  line-height: 1.2;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}
th, td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid color-mix(in srgb, var(--c-text) 12%, transparent);
}
th {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-2);
  font-weight: 700;
}

blockquote {
  border-left: 4px solid var(--c-accent);
  padding-left: 1.25rem;
  margin: 1.5rem 0;
  color: var(--c-text-2);
  font-style: italic;
}

/* ─ 风格专属增强(STYLE_DECORATIONS) ──────────────── */
${STYLE_DECORATIONS[style.id] ?? ""}
`;
}

// ─────────────────────── 风格装饰增强 ───────────────────────
// 每个风格在通用 base 之上,加自己特色装饰

const STYLE_DECORATIONS: Record<string, string> = {
  modern_pro: `
/* modern_pro: 暗色 + 橙焦点,左上角 section number 装饰 */
body { padding: 6vh 7vw; }
.h-hero, .h-xl, .h-md { color: #fff; }
body::before {
  content: "";
  position: fixed;
  top: 0; left: 0;
  width: 6px; height: 100vh;
  background: var(--c-primary);
  opacity: 0.85;
}
.callout { background: rgba(255, 87, 34, 0.12); border-left-color: var(--c-primary); }
strong { color: var(--c-primary); }
.kicker { color: var(--c-primary); }
.big-number { color: var(--c-primary); text-shadow: 0 0 30px rgba(255, 87, 34, 0.3); }
`,

  pink_girl: `
/* pink_girl: 粉色奶油 + 圆润 + 手绘装饰 */
body { padding: 7vh 7vw; }
h1, h2, h3, .h-hero, .h-xl, .h-md { font-weight: 700; letter-spacing: 0; }
body::before {
  content: "✿";
  position: fixed; top: 4vh; right: 5vw;
  font-size: 4rem; opacity: 0.15; color: var(--c-primary);
  pointer-events: none;
}
body::after {
  content: "❀";
  position: fixed; bottom: 8vh; left: 5vw;
  font-size: 3rem; opacity: 0.12; color: var(--c-accent);
  pointer-events: none;
}
.callout, .stat-card, .step-card, .left-column, .right-column,
.image-container, .image-wrapper, .visual-placeholder { border-radius: 24px; }
.kicker { color: var(--c-primary); font-weight: 700; }
strong { color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 18%, transparent); padding: 0 0.4em; border-radius: 6px; }
li::marker { color: var(--c-primary); content: "♥ "; }
`,

  academic_serif: `
/* academic_serif: 衬线学术 + 严谨网格 + 页脚作者信息 */
body { padding: 6vh 7vw; }
.kicker { font-style: italic; text-transform: none; letter-spacing: 0.02em; }
h1, h2, h3, .h-hero, .h-xl, .h-md { font-weight: 700; letter-spacing: -0.005em; }
.callout { font-style: italic; border-left-width: 3px; background: transparent; }
table th { background: var(--c-secondary); color: #fff; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em; }
body::before {
  content: "";
  position: fixed; top: 0; left: 0; right: 0;
  height: 3px; background: var(--c-primary);
}
body::after {
  content: "—";
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  font-size: 14px; color: var(--c-text-2); opacity: 0.5;
}
`,

  swiss_grid: `
/* swiss_grid: 极致网格 + 大数字 + 单色高亮 + 严苛留白 */
body { padding: 8vh 8vw; font-weight: 400; }
h1, h2, h3, .h-hero, .h-xl, .h-md { font-weight: 900; letter-spacing: -0.03em; line-height: 0.95; }
.h-hero { font-size: calc(var(--scale-h1) * 1.3rem); }
.kicker { font-size: 0.75rem; letter-spacing: 0.2em; color: var(--c-text); border-top: 2px solid var(--c-accent); padding-top: 0.5rem; }
.callout { background: var(--c-accent); color: #fff; border: 0; border-radius: 0; font-weight: 700; }
.stat-card, .step-card, .left-column, .right-column { background: transparent; padding: 1.5rem 0; border-top: 2px solid var(--c-text); border-radius: 0; }
.big-number { color: var(--c-text); font-size: calc(var(--scale-h1) * 1.1rem); }
ul li::marker { content: "◯ "; color: var(--c-accent); }
`,

  elegant_dark: `
/* elegant_dark: 深色杂志 + 衬线大字 + 摄影感框 */
body { padding: 7vh 7vw; }
h1, h2, h3, .h-hero, .h-xl, .h-md { color: var(--c-text); font-weight: 600; letter-spacing: 0.01em; }
.kicker { color: var(--c-accent); letter-spacing: 0.25em; font-weight: 500; }
.callout { font-style: italic; background: transparent; border-left: 1px solid var(--c-accent); padding-left: 2rem; font-size: 1.5rem; line-height: 1.5; }
.image-container, .image-wrapper, .visual-placeholder {
  background: linear-gradient(135deg, color-mix(in srgb, var(--c-accent) 25%, transparent), color-mix(in srgb, var(--c-primary) 15%, transparent));
  border: 1px solid color-mix(in srgb, var(--c-accent) 30%, transparent);
  min-height: 40vh;
}
strong { color: var(--c-accent); font-weight: 600; }
body::before {
  content: ""; position: fixed; bottom: 0; right: 0;
  width: 30vw; height: 30vh;
  background: radial-gradient(circle at bottom right, color-mix(in srgb, var(--c-accent) 20%, transparent), transparent 70%);
  pointer-events: none;
}
`,

  ink_classic: `
/* ink_classic: 国风水墨 + 宣纸纹 + 红印章 + 隶书 */
body {
  background: #f5efe2 !important;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.02) 0, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.02) 0, transparent 50%);
  padding: 7vh 8vw;
  color: #1f1a14;
}
h1, h2, h3, .h-hero, .h-xl, .h-md {
  font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', serif;
  font-weight: 700; letter-spacing: 0.04em; color: #1a1a1a;
}
.h-hero { writing-mode: vertical-rl; text-orientation: mixed; max-height: 70vh; margin: 0 auto; }
.kicker { color: #8b3a3a; font-style: normal; letter-spacing: 0.3em; }
.callout { background: rgba(139, 58, 58, 0.06); border-left-color: #8b3a3a; font-style: normal; }
strong { color: #8b3a3a; }
body::after {
  content: "印";
  position: fixed; bottom: 5vh; right: 6vw;
  width: 56px; height: 56px;
  background: #8b3a3a; color: #f5efe2;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Songti SC', serif; font-size: 24px; font-weight: 700;
  border-radius: 4px; transform: rotate(-3deg);
  box-shadow: 0 2px 8px rgba(139,58,58,0.3);
}
li::marker { content: "● "; color: #8b3a3a; }
`,
};
