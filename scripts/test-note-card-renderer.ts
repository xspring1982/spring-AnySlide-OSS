import assert from "node:assert/strict";
import { renderNoteCardsAsPngDataUrls } from "@/lib/cards/notes-renderer";
import type { AnalyzeOutput } from "@/lib/cards/agents";

const outline: AnalyzeOutput = {
  topic: "高效读书笔记",
  task_title: "高效读书笔记 · 2 张",
  content_type: "book-notes",
  audience_signal: "希望把书摘变成可发布笔记的人",
  language: "zh-CN",
  recommended_count: 2,
  cards: [
    {
      index: 1,
      role: "cover",
      title: "读完不等于学会",
      subtitle: "把输入变成输出,才算真正吸收。",
      key_text: "一本书最有价值的部分,不是划线最多的段落,而是你能复述、迁移、实践的那几个判断。",
      composition: "notebook_page",
      cover_hook: "contrarian",
      emphasis_words: [{ text: "输出", kind: "outcome", weight: "primary" }],
    },
    {
      index: 2,
      role: "closing",
      title: "三步复盘",
      key_text: "- 先写一句核心观点\n- 再写一个真实场景\n- 最后写下一步行动",
      composition: "stacked_cards",
      emphasis_words: [{ text: "行动", kind: "outcome", weight: "primary" }],
      content_trigger: { type: "save", phrase: "收藏这张,下次读完一本书就照着写。" },
    },
  ],
};

async function main() {
  const cards = await renderNoteCardsAsPngDataUrls({
    outline,
    ratio: "3:4",
    styleId: "xiaohongshu_fresh",
  });

  assert.equal(cards.length, 2);
  for (const card of cards) {
    assert.match(card.dataUrl, /^data:image\/png;base64,/);
    assert.ok(card.dataUrl.length > 10_000);
  }

  console.log("note card renderer checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
