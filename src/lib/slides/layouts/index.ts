// SPEC §3.4.2.2 — 10 L1 layouts(HTML 可编辑路径)
//
// 用法:
//   - §3.5.1 analyze.ts:把 LAYOUTS 列表注入 system prompt,LLM 给每页选 layout id
//   - §3.5.3.1 prompt-assembly L1 分支:用 layout.gridClass + theme CSS 渲染 HTML

import type { L1Layout, L1LayoutId } from "./types";

export const ALL_L1_LAYOUTS: L1Layout[] = [
  // 1
  {
    id: "hero-cover",
    name: "开场封面",
    category: "cover",
    visualDesc: "全屏沉浸,垂直居中:kicker → 超大标题 → 副标题 → 引导段落 → 作者信息",
    scenario: "演讲开场 / 章节序章 / 视觉冲击开篇",
    gridClass: "display:grid; align-content:center; min-height:80vh",
    slotCount: 1,
    contentSlots: {
      kicker: { maxChars: 24 },
      title: { maxChars: 40, level: "h-hero" },
      subtitle: { maxChars: 60 },
      lead: { maxChars: 100 },
      meta: { maxChars: 30 },
    },
    themeCssRequirements: ["h-hero 字号 ≥ 8vw", "隐藏页码", "可用主色填充背景"],
    selectionKeywords: ["cover", "开场", "intro", "第一张"],
  },
  // 2
  {
    id: "act-divider",
    name: "章节幕封",
    category: "divider",
    visualDesc: "极简封面,3 层:kicker → 大标题 → 单行引语;留白充足",
    scenario: "章节分隔 / 幕次开启 / 节奏呼吸点",
    gridClass: "display:grid; align-content:center; min-height:80vh",
    slotCount: 1,
    contentSlots: {
      kicker: { maxChars: 16 },
      title: { maxChars: 24, level: "h-hero" },
      lead: { maxChars: 50 },
    },
    themeCssRequirements: ["hero light/dark 交替触发", "h-hero 字号 8.5vw"],
    selectionKeywords: ["第N节", "章节", "Part", "narrative_arc"],
  },
  // 3
  {
    id: "big-numbers-grid",
    name: "数据大字报",
    category: "data",
    visualDesc: "标题区 + 6 个数据卡矩阵(3×2),每卡 label/大数字/注释",
    scenario: "硬数据抛出 / 成就展示 / 定量论证",
    gridClass: "grid-6",
    slotCount: 6,
    contentSlots: {
      kicker: { maxChars: 24 },
      title: { maxChars: 40, level: "h-xl" },
      lead: { maxChars: 60 },
      statCards: { count: 6, numberMaxChars: 4, noteMaxChars: 20 },
    },
    themeCssRequirements: [
      "stat-nb 字号 ≥ 4vw",
      "数字与注释垂直对齐",
      "卡间距均匀",
    ],
    selectionKeywords: ["数据", "统计", "指标", "KPI", "%", "≥3 个数字"],
  },
  // 4
  {
    id: "quote-image",
    name: "左文右图",
    category: "narrative",
    visualDesc: "左 7 列:kicker→标题→正文→callout(贴底);右 5 列:标准比例图",
    scenario: "故事讲述 / 身份反差 / 观点论述",
    gridClass: "grid-2-7-5",
    slotCount: 2,
    contentSlots: {
      kicker: { maxChars: 24 },
      title: { maxChars: 40, level: "h-xl" },
      lead: { maxChars: 80 },
      callout: { maxChars: 50 },
      images: { count: 1, aspectRatio: "16:10" },
    },
    themeCssRequirements: [
      "左列 flex column + space-between 让 callout 贴底",
      "右列 frame-img 比例锁定",
      "禁用 align-self:end",
    ],
    selectionKeywords: ["案例", "故事", "举例", "vs", "观点"],
  },
  // 5
  {
    id: "image-grid",
    name: "多图对比",
    category: "media",
    visualDesc: "标题区 + 3×2 或 3×1 图片网格,每张同高 ≤ 26vh,自动裁剪",
    scenario: "多平台对比 / 截图集合 / 证据支撑",
    gridClass: "grid-3-3",
    slotCount: 6,
    contentSlots: {
      kicker: { maxChars: 24 },
      title: { maxChars: 40, level: "h-xl" },
      images: { count: 6, aspectRatio: "4:3" },
    },
    themeCssRequirements: [
      "每 figure 死高度 ≤ 26vh(不用 aspect-ratio)",
      "图自动 object-fit:cover",
    ],
    selectionKeywords: ["截图", "对比", "多平台", "画廊", "≥3 张图"],
  },
  // 6
  {
    id: "pipeline",
    name: "流水线",
    category: "flow",
    visualDesc: "单组流水线:多个 step(编号/标题/描述);按 → 或空格逐步点亮",
    scenario: "工作流程 / 步骤解说 / 流程演示",
    gridClass: "pipeline-section > pipeline + steps",
    slotCount: 4,
    contentSlots: {
      kicker: { maxChars: 24 },
      title: { maxChars: 30, level: "h-md" },
      steps: { count: 5, titleMaxChars: 12, descMaxChars: 40 },
    },
    themeCssRequirements: [
      'data-anim="step" 触发逐步点亮',
      "推荐 3-5 步,单行最佳",
    ],
    selectionKeywords: ["步骤", "流程", "Step", "阶段", "怎么做", "指南"],
  },
  // 7
  {
    id: "hero-question",
    name: "问题页",
    category: "cover",
    visualDesc: "全屏悬念页:主问题分行展示(≤ 3 行)+ 简短破题语",
    scenario: "悬念收束 / 幕间转折 / 问题抛出",
    gridClass: "display:grid; align-content:center; min-height:80vh",
    slotCount: 1,
    contentSlots: {
      kicker: { maxChars: 16 },
      title: { maxChars: 50, level: "h-hero" },
      lead: { maxChars: 50 },
    },
    themeCssRequirements: [
      "h-hero 字号 7vw(适合 3 行)",
      "标题用 <span> 分块加 data-anim 实现逐行入场",
    ],
    selectionKeywords: ["?", "为什么", "如何", "What if", "Why"],
  },
  // 8
  {
    id: "big-quote",
    name: "大引用",
    category: "reference",
    visualDesc: "全屏留白 + 居中衬线超大引文(5.8vw)+ 英文原文 + 出处",
    scenario: "金句呈现 / 理论节点 / 仪式收束",
    gridClass: "display:grid; align-content:center; min-height:80vh",
    slotCount: 1,
    contentSlots: {
      kicker: { maxChars: 16 },
      quote: { maxChars: 80, attributionMaxChars: 30 },
      attribution: { maxChars: 30 },
    },
    themeCssRequirements: [
      "blockquote inline style 放大到 5.8vw",
      "衬线字体",
      '英文原文行 data-anim="line"',
    ],
    selectionKeywords: ["引用", "名言", "quote", "他说", "据《"],
  },
  // 9
  {
    id: "before-after",
    name: "对比页",
    category: "comparison",
    visualDesc: "左右对半分:左列淡出(opacity:.55)+ 右列满亮;每列含 kicker/标题/列表",
    scenario: "范式转变 / 新旧对比 / 方案演进",
    gridClass: "grid-2-6-6",
    slotCount: 2,
    contentSlots: {
      kicker: { maxChars: 16 },
      title: { maxChars: 24, level: "h-md" },
      bullets: { maxItems: 4, maxCharsPerItem: 20 },
    },
    themeCssRequirements: [
      'left data-anim="left",right data-anim="right"',
      "两列 border-left 做引用感",
    ],
    selectionKeywords: ["vs", "对比", "before", "after", "旧/新", "从X到Y"],
  },
  // 10
  {
    id: "lead-image-side-text",
    name: "图文混排",
    category: "narrative",
    visualDesc: "左 8 列多层级文本(kicker/大标题/lead/正文/callout)+ 右 4 列竖图或方图",
    scenario: "阶段详解 / 内容丰富的观点 / 流程说明",
    gridClass: "grid-2-8-4",
    slotCount: 2,
    contentSlots: {
      kicker: { maxChars: 24 },
      title: { maxChars: 40, level: "h-xl" },
      lead: { maxChars: 60 },
      body: { maxChars: 200, maxParagraphs: 2 },
      callout: { maxChars: 50 },
      images: { count: 1, aspectRatio: "3:4" },
    },
    themeCssRequirements: [
      "右列竖版 3:4 或方形 1:1",
      "左列允许多层级排版",
    ],
    selectionKeywords: ["详细", "说明", "深度", "背景", "字数 ≥ 200"],
  },
];

const INDEX: Record<L1LayoutId, L1Layout> = ALL_L1_LAYOUTS.reduce(
  (acc, l) => {
    acc[l.id] = l;
    return acc;
  },
  {} as Record<L1LayoutId, L1Layout>,
);

export function getL1Layout(id: L1LayoutId): L1Layout {
  const l = INDEX[id];
  if (!l) throw new Error(`Unknown L1 layout: ${id}`);
  return l;
}

export type { L1Layout, L1LayoutId, L1Category, L1ContentSlots } from "./types";
