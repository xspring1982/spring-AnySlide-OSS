// Phase 2 PR35:Blueprint → PDF demo
//
// 跑法:
//   npx tsx scripts/demo-blueprint-to-pdf.ts
//
// 输出:/tmp/anyslide-demo.pdf
// 跟 demo-blueprint-to-pptx.ts 同一份 mock 数据,对比 PPTX/PDF 两种格式效果。

import * as fs from "node:fs";
import { blueprintToPdf } from "@/lib/slides/exporters/blueprint-to-pdf";
import type { DeckBlueprint } from "@/lib/slides/blueprint/schema";

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
  console.log("生成 .pdf (playwright headless)...");
  const buf = await blueprintToPdf(deck);
  const outPath = "/tmp/anyslide-demo.pdf";
  fs.writeFileSync(outPath, buf);
  console.log(`✅ 输出: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  console.log(`   打开: open ${outPath}`);
})();
