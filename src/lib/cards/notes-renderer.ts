import { chromium } from "playwright";
import type { AnalyzeCard, AnalyzeOutput } from "./agents";

type NoteRatio = "3:4" | "4:5" | "1:1" | "9:16" | "16:9" | "3:2" | "2:3";

interface NoteCardRenderInput {
  outline: AnalyzeOutput;
  ratio: string;
  styleId: string;
}

interface RenderedNoteCard {
  pageNo: number;
  role: AnalyzeCard["role"];
  filename: string;
  dataUrl: string;
}

const RATIO_SIZE: Record<NoteRatio, { w: number; h: number }> = {
  "3:4": { w: 1080, h: 1440 },
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1600, h: 900 },
  "3:2": { w: 1500, h: 1000 },
  "2:3": { w: 1000, h: 1500 },
};

const THEMES: Record<
  string,
  {
    bg: string;
    paper: string;
    ink: string;
    muted: string;
    accent: string;
    accentSoft: string;
    border: string;
    font: string;
    heading: string;
  }
> = {
  xiaohongshu_fresh: {
    bg: "#F7EFE8",
    paper: "#FFFDFC",
    ink: "#1F1F1F",
    muted: "#756A62",
    accent: "#C96B35",
    accentSoft: "#F5D7C2",
    border: "#E7D3C4",
    font: '"PingFang SC", "Noto Sans CJK SC", sans-serif',
    heading: '"PingFang SC", "Noto Sans CJK SC", sans-serif',
  },
  minimal_whitespace: {
    bg: "#F5F5F2",
    paper: "#FFFFFF",
    ink: "#151515",
    muted: "#6B6B6B",
    accent: "#111111",
    accentSoft: "#E8E8E4",
    border: "#D9D9D2",
    font: '"Inter", "PingFang SC", sans-serif',
    heading: '"Inter", "PingFang SC", sans-serif',
  },
  vintage_magazine: {
    bg: "#EADDCB",
    paper: "#FFF6E8",
    ink: "#221813",
    muted: "#7C6152",
    accent: "#B6422E",
    accentSoft: "#EEC7A8",
    border: "#C9A98D",
    font: '"Times New Roman", "Songti SC", serif',
    heading: '"Times New Roman", "Songti SC", serif',
  },
  ink_chinese: {
    bg: "#EFECE4",
    paper: "#FBF8EF",
    ink: "#20201D",
    muted: "#6F6A5E",
    accent: "#A33A2A",
    accentSoft: "#DED5C4",
    border: "#CFC4AE",
    font: '"Songti SC", "Noto Serif CJK SC", serif',
    heading: '"Songti SC", "Noto Serif CJK SC", serif',
  },
};

export async function renderNoteCardsAsPngDataUrls(
  input: NoteCardRenderInput,
): Promise<RenderedNoteCard[]> {
  const ratio = normalizeRatio(input.ratio);
  const size = RATIO_SIZE[ratio];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 1,
    });

    const rendered: RenderedNoteCard[] = [];
    for (const card of input.outline.cards) {
      const html = renderNoteCardHtml({
        card,
        outline: input.outline,
        ratio,
        styleId: input.styleId,
      });
      await page.setContent(html, { waitUntil: "load" });
      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: size.w, height: size.h },
      });
      rendered.push({
        pageNo: card.index,
        role: card.role,
        filename: `${card.index}-${card.composition}.png`,
        dataUrl: `data:image/png;base64,${png.toString("base64")}`,
      });
    }
    return rendered;
  } finally {
    await browser.close();
  }
}

function renderNoteCardHtml(args: {
  card: AnalyzeCard;
  outline: AnalyzeOutput;
  ratio: NoteRatio;
  styleId: string;
}): string {
  const { card, outline, ratio } = args;
  const theme = THEMES[args.styleId] ?? THEMES.xiaohongshu_fresh;
  const size = RATIO_SIZE[ratio];
  const bodySize = bodyFontSize(card.key_text, ratio);
  const isCover = card.role === "cover";
  const isClosing = card.role === "closing";
  const pageLabel = `${card.index}/${outline.cards.length}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${size.w},initial-scale=1" />
<style>
* { box-sizing: border-box; }
html, body { margin: 0; width: ${size.w}px; height: ${size.h}px; overflow: hidden; }
body {
  width: ${size.w}px;
  height: ${size.h}px;
  background:
    radial-gradient(circle at 18% 12%, ${theme.accentSoft} 0 12%, transparent 28%),
    linear-gradient(135deg, ${theme.bg}, ${theme.paper});
  color: ${theme.ink};
  font-family: ${theme.font};
}
.card {
  position: relative;
  width: 100%;
  height: 100%;
  padding: ${isWide(ratio) ? "58px 74px" : "76px 72px"};
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 28px;
}
.frame {
  position: absolute;
  inset: ${isWide(ratio) ? "34px" : "42px"};
  border: 3px solid ${theme.border};
  border-radius: 32px;
  pointer-events: none;
}
.topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  color: ${theme.muted};
  font-size: ${isWide(ratio) ? 20 : 24}px;
  letter-spacing: 0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
}
.brand::before {
  content: "";
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: ${theme.accent};
  display: inline-block;
}
.main {
  align-self: center;
  display: grid;
  gap: ${isWide(ratio) ? 24 : 34}px;
}
.kicker {
  color: ${theme.accent};
  font-size: ${isWide(ratio) ? 22 : 28}px;
  font-weight: 800;
}
h1 {
  margin: 0;
  font-family: ${theme.heading};
  font-size: ${titleFontSize(card.title, ratio, isCover)}px;
  line-height: 1.03;
  letter-spacing: 0;
  max-width: ${isWide(ratio) ? "78%" : "100%"};
}
.subtitle {
  margin: 0;
  color: ${theme.muted};
  font-size: ${isWide(ratio) ? 28 : 34}px;
  line-height: 1.35;
  font-weight: 600;
}
.body {
  max-width: ${isWide(ratio) ? "82%" : "100%"};
  font-size: ${bodySize}px;
  line-height: 1.58;
}
.body p {
  margin: 0 0 18px;
}
.body ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 14px;
}
.body li {
  position: relative;
  padding-left: 34px;
}
.body li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.72em;
  width: 16px;
  height: 3px;
  background: ${theme.accent};
}
.trigger {
  display: ${card.content_trigger ? "block" : "none"};
  margin-top: 6px;
  padding: 18px 22px;
  border-left: 7px solid ${theme.accent};
  background: color-mix(in srgb, ${theme.accentSoft} 52%, white);
  font-size: ${isWide(ratio) ? 20 : 25}px;
  line-height: 1.4;
  font-weight: 700;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.chip {
  padding: 9px 15px;
  border-radius: 999px;
  background: ${theme.accentSoft};
  color: ${theme.ink};
  font-size: ${isWide(ratio) ? 16 : 20}px;
  font-weight: 700;
}
.foot {
  display: flex;
  justify-content: space-between;
  align-items: end;
  color: ${theme.muted};
  font-size: ${isWide(ratio) ? 18 : 22}px;
}
.topic {
  max-width: 70%;
  font-weight: 700;
}
.page {
  color: ${theme.accent};
  font-weight: 900;
  font-size: ${isWide(ratio) ? 44 : 52}px;
}
.cover h1, .closing h1 {
  color: ${theme.ink};
}
.cover .main, .closing .main {
  align-self: center;
}
.cover .body, .closing .body {
  font-size: ${isWide(ratio) ? 28 : 36}px;
  color: ${theme.muted};
  font-weight: 650;
}
</style>
</head>
<body>
  <article class="card ${card.role}">
    <div class="frame"></div>
    <header class="topline">
      <div class="brand">图文笔记</div>
      <div>${escapeHtml(outline.content_type)}</div>
    </header>
    <main class="main">
      <div class="kicker">${isCover ? "Cover" : isClosing ? "Closing" : `Note ${card.index}`}</div>
      <h1>${escapeHtml(card.title)}</h1>
      ${card.subtitle ? `<p class="subtitle">${escapeHtml(card.subtitle)}</p>` : ""}
      <section class="body">${renderKeyText(card.key_text)}</section>
      ${
        card.content_trigger
          ? `<aside class="trigger">${escapeHtml(card.content_trigger.phrase)}</aside>`
          : ""
      }
      ${renderEmphasisChips(card)}
    </main>
    <footer class="foot">
      <div class="topic">${escapeHtml(outline.topic || outline.task_title)}</div>
      <div class="page">${pageLabel}</div>
    </footer>
  </article>
</body>
</html>`;
}

function renderKeyText(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((line) => /^[-*•\d]+[.)、\s]/.test(line));
  if (bulletLines.length >= Math.max(2, Math.floor(lines.length / 2))) {
    return `<ul>${bulletLines
      .map((line) => line.replace(/^[-*•\d]+[.)、\s]*/, ""))
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("")}</ul>`;
  }
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function renderEmphasisChips(card: AnalyzeCard): string {
  const chips = card.emphasis_words
    .map((w) => w.text.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (chips.length === 0) return "";
  return `<div class="chips">${chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("")}</div>`;
}

function normalizeRatio(raw: string): NoteRatio {
  if (raw in RATIO_SIZE) return raw as NoteRatio;
  return "3:4";
}

function isWide(ratio: NoteRatio): boolean {
  return ratio === "16:9" || ratio === "3:2";
}

function titleFontSize(title: string, ratio: NoteRatio, cover: boolean): number {
  const base = cover ? (isWide(ratio) ? 76 : 96) : isWide(ratio) ? 64 : 78;
  if (title.length > 22) return base - 18;
  if (title.length > 14) return base - 10;
  return base;
}

function bodyFontSize(text: string, ratio: NoteRatio): number {
  const base = isWide(ratio) ? 25 : 31;
  if (text.length > 260) return base - 7;
  if (text.length > 160) return base - 4;
  return base;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
