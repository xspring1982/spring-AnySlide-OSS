// Phase 1 PR32:Blueprint 端到端 demo 脚本
//
// 跑法:
//   npx tsx scripts/demo-blueprint-render.ts
//
// 验证:
//   1. extractTemplateSlots 能从 demo-template.html 扫出 5 个 section 的 slot 契约
//   2. slotSchemasToPrompt 能把契约转成 LLM 友好的 markdown
//   3. renderBlueprintSection 能把 mock blueprint 严格填进模板
//   4. 输出最终 HTML 到 /tmp/blueprint-rendered.html(用浏览器打开看效果)
//
// 这是 Phase 1 地基的"hello world"验证,不动现有 fillL1Template 链路。

import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractTemplateSlots,
  slotSchemasToPrompt,
} from "@/lib/slides/blueprint/slot-extractor";
import { renderBlueprintSection } from "@/lib/slides/blueprint/renderer";
import type { SlideBlueprint } from "@/lib/slides/blueprint/schema";

// 1. 读 demo template
const templatePath = path.resolve(
  process.cwd(),
  "src/lib/slides/blueprint/demo-template.html",
);
const templateHtml = fs.readFileSync(templatePath, "utf-8");

// 2. 扫 slot 契约
const schemas = extractTemplateSlots(templateHtml);
console.log("═══ 扫到的 slot 契约 ═══");
console.log(JSON.stringify(schemas, null, 2));

console.log("\n═══ 转成 LLM prompt ═══");
console.log(slotSchemasToPrompt(schemas));

// 3. mock blueprint — 5 页 Q2 销售复盘(模拟 LLM 输出)
const mockBlueprints: SlideBlueprint[] = [
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
      items: [
        "Q2 数据回顾",
        "增长结构分析",
        "Q3 三大策略",
        "团队致谢",
      ],
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
];

// 4. 把模板按 section 拆,每个 section 单独 render
//    简单做法:用 cheerio 拆 + 重新拼
import * as cheerio from "cheerio";
const $ = cheerio.load(templateHtml);
const sectionsHtml: string[] = [];
$("section").each((i, el) => {
  const sectionHtml = $.html(el) ?? "";
  const bp = mockBlueprints.find((b) => b.template_section_index === i + 1);
  if (!bp) {
    sectionsHtml.push(sectionHtml);
    return;
  }
  const result = renderBlueprintSection(sectionHtml, bp);
  console.log(
    `\n[Section ${i + 1}] render 完成,warnings: ${result.warnings.length}`,
  );
  for (const w of result.warnings) {
    console.log(`  ⚠️ ${w.kind} - slot=${w.slot}${w.detail ? " - " + w.detail : ""}`);
  }
  sectionsHtml.push(result.html);
});

// 5. 把 rendered sections 替换回原 HTML 输出
const headEnd = templateHtml.indexOf("</head>");
const bodyClose = templateHtml.lastIndexOf("</body>");
const finalHtml = [
  templateHtml.slice(0, headEnd + 7), // 包含 </head>
  "<body>",
  sectionsHtml.join("\n"),
  templateHtml.slice(bodyClose),
].join("\n");

const outPath = "/tmp/blueprint-rendered.html";
fs.writeFileSync(outPath, finalHtml, "utf-8");
console.log(`\n✅ 输出: ${outPath}`);
console.log(`   浏览器打开: open ${outPath}`);
