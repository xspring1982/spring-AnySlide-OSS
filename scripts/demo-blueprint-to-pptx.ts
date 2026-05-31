// Phase 2 PR34:Blueprint → Native PPTX demo
//
// 跑法:
//   npx tsx scripts/demo-blueprint-to-pptx.ts
//
// 输出:/tmp/anyslide-demo.pptx
// 用 PowerPoint / Keynote / WPS 打开看效果。
// 每个 text 都能点选、改文字、换色 — 真 native PPTX,跟 AnyGen 一个级别。

import * as fs from "node:fs";
import { blueprintToPptx } from "@/lib/slides/exporters/blueprint-to-pptx";
import type { DeckBlueprint } from "@/lib/slides/blueprint/schema";

// 跟 demo-blueprint-render.ts 同一份 mock 数据(为了对比 HTML / PPTX 输出)
const deck: DeckBlueprint = {
  meta: {
    title: "Q2 2026 销售业绩回顾",
    topic: "Q2 销售复盘 + Q3 规划",
    template_id: "demo-mvp",
    locale: "zh",
    ratio: "16:9",
  },
  slides: [
    {
      page_no: 1,
      template_section_index: 1,
      role: "cover",
      slots: {
        title: "Q2 2026 销售业绩回顾",
        subtitle: "核心指标达成 · Q3 战略规划",
        byline: "销售部 · 2026 年 5 月",
      },
    },
    {
      page_no: 2,
      template_section_index: 2,
      role: "agenda",
      slots: {
        title: "今天讲什么",
        items: ["Q2 数据回顾", "增长结构分析", "Q3 三大策略", "团队致谢"],
      },
    },
    {
      page_no: 3,
      template_section_index: 3,
      role: "content",
      slots: {
        title: "Q2 核心指标",
        lead: "整体达成率 107%,新客户拉新远超预期,6 月单月营收创历史新高。",
        bullets: [
          "总营收 1,450 万(达成率 107%)",
          "净利润 320 万(同比增长 15%)",
          "新增客户 128 家(核心区域贡献 60%)",
        ],
      },
      speaker_notes: "强调 6 月单月新高,引出 Q3 加码下沉市场的策略",
    },
    {
      page_no: 4,
      template_section_index: 4,
      role: "content",
      slots: {
        label: "本季度新增客户",
        big_number: "128",
        caption: "其中核心区域贡献 60% — 下沉市场策略验证成功",
      },
    },
    {
      page_no: 5,
      template_section_index: 5,
      role: "closing",
      slots: {
        title: "谢谢",
        contact: "Q&A · support@example.com",
      },
    },
  ],
};

(async () => {
  console.log("生成 .pptx...");
  const buf = await blueprintToPptx(deck);
  const outPath = "/tmp/anyslide-demo.pptx";
  fs.writeFileSync(outPath, buf);
  console.log(`✅ 输出: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  console.log(`   PowerPoint 打开: open ${outPath}`);
  console.log(`   ↑ 用户在 PowerPoint 里可以点任何文字编辑、改色、重排 — 真 native PPTX`);
})();
