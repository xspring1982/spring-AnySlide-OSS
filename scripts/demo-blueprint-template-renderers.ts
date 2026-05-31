// Phase 2 续 PR50:跑两个新模板专属 renderer 的 smoke 测试
//
// 输出 2 个 .pptx 文件到 /tmp:
//   /tmp/anyslide-blue-pro.pptx
//   /tmp/anyslide-bold-poster.pptx
//
// 用 PowerPoint / Keynote / WPS 打开看效果,然后跟 HTML 版对照:
//   open src/lib/slides/templates/external/blue-professional.html  (浏览器看)
//   open /tmp/anyslide-blue-pro.pptx                              (PPTX 看)
//
// 跑法:
//   npx tsx scripts/demo-blueprint-template-renderers.ts

import * as fs from "node:fs";
import { blueprintToPptx } from "@/lib/slides/exporters/blueprint-to-pptx";
import type { DeckBlueprint } from "@/lib/slides/blueprint/schema";

/** 共享 slides 内容 — 只改 template_id 看渲染差异 */
const SHARED_SLIDES: DeckBlueprint["slides"] = [
  {
    page_no: 1,
    template_section_index: 1,
    role: "cover",
    slots: {
      title: "Q2 2026 战略规划",
      subtitle: "重新评估业务重点 / 锁定 Q3 三大优先事项 / 用数据驱动决策",
      byline: "战略部 · 2026 年 5 月 · 内部",
    },
  },
  {
    page_no: 2,
    template_section_index: 2,
    role: "agenda",
    slots: {
      title: "今天讲什么",
      items: [
        "Q2 数据复盘",
        "市场结构变化",
        "竞争格局判断",
        "Q3 优先事项",
      ],
    },
  },
  {
    page_no: 3,
    template_section_index: 3,
    role: "content",
    slots: {
      title: "市场结构变化",
      lead: "用户决策路径在缩短,头部品牌集中度提升,中长尾品牌承压。",
      bullets: [
        "头部 3 品牌合计份额 56%,环比 +4 pts",
        "中型品牌增速 -8%,新客获取成本 +22%",
        "细分赛道用户决策周期缩短至 7 天",
        "全行业 DAU 同比 +15%,转化率 +1.2 pts",
      ],
    },
    speaker_notes: "重点说头部集中度的变化,引出 Q3 拼速度的策略",
  },
  {
    page_no: 4,
    template_section_index: 4,
    role: "content",
    slots: {
      label: "Q2 关键指标",
      big_number: "107%",
      caption:
        "整体达成率 107%,新客户增长远超预期,6 月单月营收创历史新高。",
    },
  },
  {
    page_no: 5,
    template_section_index: 5,
    role: "content",
    layout_intent: "comparison",
    slots: {
      title: "Q2 到 Q3 的策略切换",
      left_title: "Q2:验证阶段",
      left_items: ["测试渠道效率", "识别高价值客群", "控制投放风险"],
      right_title: "Q3:放大阶段",
      right_items: ["集中预算到头部渠道", "扩展关键区域", "建立周度复盘机制"],
    },
  },
  {
    page_no: 6,
    template_section_index: 6,
    role: "content",
    layout_intent: "timeline",
    slots: {
      title: "Q3 推进节奏",
      steps: ["6 月完成策略冻结", "7 月启动区域试点", "8 月复制有效打法", "9 月收口复盘"],
    },
  },
  {
    page_no: 7,
    template_section_index: 7,
    role: "content",
    layout_intent: "quote",
    slots: {
      quote: "用更短的反馈周期,换更高的执行确定性。",
      attribution: "Q3 经营原则",
    },
  },
  {
    page_no: 8,
    template_section_index: 8,
    role: "content",
    layout_intent: "two_column",
    slots: {
      title: "两条主线并行推进",
      left_title: "增长侧",
      left_body: "聚焦高转化渠道,把预算集中到已经验证有效的区域和素材组合。",
      right_title: "交付侧",
      right_body: "同步提升履约速度和客户成功响应,避免增长放大后体验下滑。",
    },
  },
  {
    page_no: 9,
    template_section_index: 9,
    role: "content",
    layout_intent: "single_text",
    slots: {
      title: "管理重点",
      lead: "Q3 不追求同时做很多事,而是把少数关键动作做透。",
      body: "每周用同一套指标看渠道效率、客户质量和交付压力,及时停止低确定性的投入。",
    },
  },
  {
    page_no: 10,
    template_section_index: 10,
    role: "section_divider",
    slots: { title: "Q3 三大优先事项" },
  },
  {
    page_no: 11,
    template_section_index: 11,
    role: "closing",
    slots: {
      title: "Thank you",
      subtitle: "如有问题或需进一步讨论,欢迎随时联系。",
      contact: "support@example.com · AnySlide",
    },
  },
];

async function generate(templateId: string, outPath: string) {
  const deck: DeckBlueprint = {
    meta: {
      title: "Q2 2026 战略规划",
      topic: "Q2 复盘 + Q3 优先事项",
      template_id: templateId,
      locale: "zh",
      ratio: "16:9",
    },
    slides: SHARED_SLIDES,
  };
  const buf = await blueprintToPptx(deck);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${templateId.padEnd(28)} → ${outPath} (${buf.length} B)`);
}

async function main() {
  await generate("ext-blue-professional", "/tmp/anyslide-blue-pro.pptx");
  await generate("ext-bold-poster", "/tmp/anyslide-bold-poster.pptx");
  // 对照组:同 blueprint 但 templateId 不在注册表 → 走 generic
  await generate("nonexistent-template", "/tmp/anyslide-generic.pptx");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
