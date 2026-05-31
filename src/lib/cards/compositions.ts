// SPEC §2.3 + §2.3.1 + §2.3.2 — Cards 构图库
//
// 三块：
//   §2.3   — 30 种正文构图（6 类 × 5）
//   §2.3.1 — 4 种封面构图 + 3 种收尾构图
//   §2.3.2 — agent 选构图规则（纯函数）
//
// 用法：
//   - §2.6.1 analyze.ts 在生成 outline 时为每张卡片调 selectComposition() 选 1 个
//   - §2.6.4 prompt-assembly.ts 拼装最终图像 prompt 时 getCompositionLayout(id) 注入英文 layout 描述
//
// 风格偏好（§2.3.2 规则 c）依赖 §2.4 风格 schema 的 preferredCompositions / avoidCompositions 字段，
// 在 §2.4 落地后由 selectComposition 的 styleHints 参数注入；当前先实现规则 a/b/d。

// ─────────────────────────── 类型 ───────────────────────────

/** 6 大类 + cover + closing — SPEC §2.3 表头 */
export type CompositionCategory =
  | "linear_flow" // 一、线性流程类
  | "hierarchy" // 二、层级结构类
  | "circular" // 三、圆形环绕类
  | "comparison" // 四、对比并列类
  | "container" // 五、容器承载类
  | "path_map" // 六、路径地图类
  | "cover" // §2.3.1 封面
  | "closing"; // §2.3.1 收尾

/** SPEC §2.3 推荐 role 字段：构图能用作哪种角色 */
export type CompositionRole = "cover" | "content" | "closing";

/** 单条构图记录 */
export interface Composition {
  /** SPEC 中的 snake_case id */
  id: CompositionId;
  /** 中文显示名（debug / 模板预设用） */
  nameZh: string;
  /** 所属大类 */
  category: CompositionCategory;
  /** 中文：适用场景 — 用于 prompt 时给 Claude 看的 hint */
  suitableFor: string;
  /** 推荐 role，单值或多值 */
  recommendedRoles: CompositionRole[];
  /**
   * 英文 layout 描述 — 注入到最终 image prompt 用。
   * 来源：SPEC §2.3 / §2.3.1 三引号块原文，**不要中文化**。
   */
  layoutEnglish: string;
  /** 可选备注（SPEC 表的"备注"列） */
  note?: string;
}

// 30 + 4 + 3 = 37 个构图 id，全部 snake_case，与 SPEC 一字不差
export type CompositionId =
  // 一、线性流程类
  | "vertical_timeline"
  | "winding_path"
  | "staircase"
  | "waterfall_flow"
  | "stacked_cards"
  // 二、层级结构类
  | "pyramid_up"
  | "pyramid_down"
  | "iceberg"
  | "tree"
  | "root_system"
  // 三、圆形环绕类
  | "central_radial"
  | "concentric_target"
  | "cycle_loop"
  | "flower_petals"
  | "sunburst"
  // 四、对比并列类
  | "split_top_bottom"
  | "split_left_right"
  | "horizontal_bands"
  | "mini_cards_stack"
  | "masonry_2col"
  // 五、容器承载类
  | "notebook_page"
  | "unrolled_scroll"
  | "sticky_notes_wall"
  | "phone_screen"
  | "bookmark_strips"
  // 六、路径地图类
  | "mountain_climb"
  | "river_confluence"
  | "metro_line"
  | "game_map"
  | "growth_tree"
  // 兜底（SPEC §2.3 头注：剩余长尾用 bento_layout 兜底；这里 id=19 在对比类的 masonry 之外暂未引入，
  //  规范明确 fallback 为 bento_layout — 加入但归 comparison 大类，便于覆盖率统计）
  // ↑ SPEC 原文 19 号其实就是 masonry_2col；bento_layout 在 SPEC 中未单列，作为兜底 id 保留供 selector 使用，
  //   不出现在 30 主表内。这里通过 selectComposition fallback 路径处理，不在 type 中外露。

  // 封面构图（§2.3.1）
  | "centered_quote_seal"
  | "hero_title"
  | "bold_headline"
  | "magazine_cover"
  // 收尾构图（§2.3.1）
  | "action_card"
  | "closing_summary"
  | "cta_share";

// ─────────────────────────── 一、线性流程类（5）───────────────────────────

const LINEAR_FLOW: Composition[] = [
  {
    id: "vertical_timeline",
    nameZh: "纵向时间线型",
    category: "linear_flow",
    suitableFor: "5-8 个里程碑 / 历史事件",
    recommendedRoles: ["content"],
    note: "节点左右交替，中线连接",
    layoutEnglish: `Layout: vertical timeline running down the center of the card. Each milestone
node alternates left and right along the central axis, connected by a solid
vertical line with small circular markers. Numbered sequentially top to bottom.`,
  },
  {
    id: "winding_path",
    nameZh: "蜿蜒路径型",
    category: "linear_flow",
    suitableFor: "4-6 个步骤，故事感强",
    recommendedRoles: ["content"],
    note: "S 形路径，可走道路/河流隐喻",
    layoutEnglish: `Layout: S-shaped winding path flowing vertically from top to bottom. Content
nodes are placed along the curves of the path, alternating sides at each bend.
The path uses a bold illustrated road or river metaphor.`,
  },
  {
    id: "staircase",
    nameZh: "阶梯递进型",
    category: "linear_flow",
    suitableFor: "3-5 步进阶（成长向上）",
    recommendedRoles: ["content"],
    note: "左下→右上，递进感",
    layoutEnglish: `Layout: staircase structure ascending from bottom-left to top-right. Each step
is a distinct labeled block, slightly elevated above the previous. Arrows or
connectors indicate upward progression between steps.`,
  },
  {
    id: "waterfall_flow",
    nameZh: "瀑布流程型",
    category: "linear_flow",
    suitableFor: "3-7 步流程图（无故事）",
    recommendedRoles: ["content"],
    note: "全宽矩形堆叠，箭头连接",
    layoutEnglish: `Layout: vertical flowchart cascading from top to bottom. Each step occupies a
full-width rounded rectangle, connected by downward arrows. Background color
alternates or deepens slightly at each level to show progression.`,
  },
  {
    id: "stacked_cards",
    nameZh: "竖向递进卡片型",
    category: "linear_flow",
    suitableFor: "3-5 个并列要点",
    recommendedRoles: ["content"],
    note: "简单卡片堆叠，最通用",
    layoutEnglish: `Layout: 3 to 5 stacked horizontal cards arranged vertically, each card
containing one main theme with an icon and short text. Cards are evenly
spaced with subtle shadow depth, giving a layered deck appearance.`,
  },
];

// ─────────────────────────── 二、层级结构类（5）───────────────────────────

const HIERARCHY: Composition[] = [
  {
    id: "pyramid_up",
    nameZh: "正金字塔型",
    category: "hierarchy",
    suitableFor: "3-5 层基础到尖端",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: upright pyramid divided into 3 to 5 horizontal tiers, widest at the
bottom and narrowest at the top. Each tier is labeled with a category or
priority level. The apex represents the highest-level concept.`,
  },
  {
    id: "pyramid_down",
    nameZh: "倒金字塔型",
    category: "hierarchy",
    suitableFor: "优先级排序 / 漏斗筛选",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: inverted pyramid, widest at the top tapering to a point at the bottom.
The top tier holds the most important or broadest information, with supporting
details narrowing downward. Often used for priority ranking or filtering.`,
  },
  {
    id: "iceberg",
    nameZh: "冰山模型型",
    category: "hierarchy",
    suitableFor: "表面 vs 深层（5% vs 95%）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: iceberg cross-section split horizontally by a waterline. The visible
tip above water shows surface-level information; the larger submerged mass
below reveals deeper, hidden layers. Labels on both sections.`,
  },
  {
    id: "tree",
    nameZh: "树状结构型",
    category: "hierarchy",
    suitableFor: "单根多分类（思维导图）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: tree diagram with a single root node at the top, branching downward
into progressively more specific sub-nodes. Connecting lines show hierarchy.
Each leaf node contains a concise label or icon.`,
  },
  {
    id: "root_system",
    nameZh: "根系结构型",
    category: "hierarchy",
    suitableFor: "单结果多原因（因果分析）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: inverted tree with a single outcome or result at the top, and multiple
root causes or contributing factors spreading downward like roots. Used for
cause-and-effect or factor analysis.`,
  },
];

// ─────────────────────────── 三、圆形环绕类（5）───────────────────────────

const CIRCULAR: Composition[] = [
  {
    id: "central_radial",
    nameZh: "中心发散型",
    category: "circular",
    suitableFor: "1 核心 + 4-8 衍生",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: central hub with 4 to 8 satellite modules radiating outward like spokes.
The core concept occupies a prominent circle in the center; surrounding nodes
are connected by lines or arrows pointing outward.`,
  },
  {
    id: "concentric_target",
    nameZh: "同心圆靶心型",
    category: "circular",
    suitableFor: "由内向外的层次扩展",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: concentric circles like a bullseye, with the most fundamental concept
at the innermost ring expanding outward to broader contexts. Each ring is
distinctly colored or labeled, reading from inside out.`,
  },
  {
    id: "cycle_loop",
    nameZh: "循环圈型",
    category: "circular",
    suitableFor: "4-6 阶段循环（PDCA）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: circular loop of 4 to 6 nodes arranged evenly around a ring, with
arrows connecting them in a continuous cycle. Each node represents a phase
or step. The cycle has no fixed start or end point.`,
  },
  {
    id: "flower_petals",
    nameZh: "花瓣环绕型",
    category: "circular",
    suitableFor: "1 主题 + 6-8 子要点",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: central circle surrounded by petal-shaped elements, each petal
containing one supporting point or subtopic. The petals radiate symmetrically
like a flower, connected to the center hub.`,
  },
  {
    id: "sunburst",
    nameZh: "太阳放射型",
    category: "circular",
    suitableFor: "关键词云 / 标签密集型",
    recommendedRoles: ["content", "cover"],
    layoutEnglish: `Layout: sun-burst design with a bold central circle and short radiating lines
or elongated panels extending outward in all directions. Each ray holds a
keyword or brief label. Energetic and expansive visual feel.`,
  },
];

// ─────────────────────────── 四、对比并列类（5）───────────────────────────

const COMPARISON: Composition[] = [
  {
    id: "split_top_bottom",
    nameZh: "上下对比型",
    category: "comparison",
    suitableFor: "二元对照（上 vs 下）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: card divided horizontally into two equal halves by a clear dividing
line or contrasting background colors. Top half presents one concept or
perspective; bottom half presents the opposing or complementary view.`,
  },
  {
    id: "split_left_right",
    nameZh: "左右对比型",
    category: "comparison",
    suitableFor: "二元对照（左 vs 右，VS 感强）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: card split vertically into two columns. Left column and right column
each contain parallel content for direct side-by-side comparison. A central
divider (line, icon, or VS badge) separates the two sides.`,
  },
  {
    id: "horizontal_bands",
    nameZh: "竖向多栏型",
    category: "comparison",
    suitableFor: "3-4 行并列要点（每行带图标）",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: 3 to 4 equal-width horizontal bands stacked vertically, each band
functioning as a self-contained content row with an icon, label, and brief
description. Alternating background tints distinguish each row.`,
  },
  {
    id: "mini_cards_stack",
    nameZh: "竖版卡片堆叠型",
    category: "comparison",
    suitableFor: "3-5 张层叠迷你卡",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: 3 to 5 individual mini-cards stacked vertically with slight overlap or
gap between them, each card slightly offset or color-coded. Each card contains
one self-contained point. Creates a layered notebook or file stack effect.`,
  },
  {
    id: "masonry_2col",
    nameZh: "双列瀑布流型",
    category: "comparison",
    suitableFor: "6-10 个不同长度要点",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: two-column masonry grid where content blocks of varying heights are
arranged in a flowing, staggered pattern across both columns. Creates a
dynamic, Pinterest-style visual rhythm within the vertical card format.`,
  },
];

// ─────────────────────────── 五、容器承载类（5）───────────────────────────

const CONTAINER: Composition[] = [
  {
    id: "notebook_page",
    nameZh: "竖版笔记本型",
    category: "container",
    suitableFor: "笔记 / 心得 / 学习记录",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: the entire card is designed to look like an open notebook page.
Features ruled lines, a spiral binding graphic on one side, handwritten-style
typography, and margin annotations. Content is arranged as if hand-written.`,
  },
  {
    id: "unrolled_scroll",
    nameZh: "卷轴展开型",
    category: "container",
    suitableFor: "国风 / 古典 / 文学题材",
    recommendedRoles: ["cover", "content"],
    layoutEnglish: `Layout: the card resembles an unrolled vertical scroll, with decorative rolled
ends at the top and bottom. Content is presented in the center of the scroll
in a traditional or editorial format. Often used for classical or literary themes.`,
  },
  {
    id: "sticky_notes_wall",
    nameZh: "便签墙竖版型",
    category: "container",
    suitableFor: "头脑风暴 / 多要点散点",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: the card surface is filled with multiple sticky note rectangles of
varying sizes and pastel colors, arranged in an overlapping collage. Each note
contains a short point or keyword, mimicking a brainstorming wall.`,
  },
  {
    id: "phone_screen",
    nameZh: "手机屏幕型",
    category: "container",
    suitableFor: "App 介绍 / 社媒展示",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: the card depicts a realistic smartphone frame (front face only),
with content displayed inside the screen area as if it were an app or social
media post. Status bar visible at top; home indicator at bottom.`,
  },
  {
    id: "bookmark_strips",
    nameZh: "书签标签型",
    category: "container",
    suitableFor: "3-5 个分类速查",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: the card is divided into 3 to 5 narrow vertical bookmark strips side
by side, each bookmark representing one topic or category. Each strip has a
colored tab at the top and content below. Resembles tabbed reference cards.`,
  },
];

// ─────────────────────────── 六、路径地图类（5）───────────────────────────

const PATH_MAP: Composition[] = [
  {
    id: "mountain_climb",
    nameZh: "山峰攀登型",
    category: "path_map",
    suitableFor: "目标达成 / 阶段成长",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: illustrated mountain rising from the bottom of the card to a peak at
the top. The climbing path is marked with base camps or checkpoints at regular
intervals along the slope. Each checkpoint is labeled with a milestone or goal.`,
  },
  {
    id: "river_confluence",
    nameZh: "河流汇聚型",
    category: "path_map",
    suitableFor: "多因素汇聚成果",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: multiple thin streams or tributaries at the top of the card converge
and merge into a single wide river flowing toward the bottom. Each tributary
represents a contributing factor; the main river represents the unified outcome.`,
  },
  {
    id: "metro_line",
    nameZh: "竖版地铁线路型",
    category: "path_map",
    suitableFor: "学习路径 / 职业规划",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: vertical metro/subway line running top to bottom, with labeled station
stops at regular intervals. Each station marker is a circle or diamond on the
line. Branch lines may diverge at certain stations to show alternatives.`,
  },
  {
    id: "game_map",
    nameZh: "游戏关卡地图型",
    category: "path_map",
    suitableFor: "教程通关 / 成就感强",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: top-down game map viewed vertically, with a START point at the bottom
and a GOAL or BOSS at the top. The path winds through labeled stages or levels,
with illustrated terrain, obstacles, and reward icons along the route.`,
  },
  {
    id: "growth_tree",
    nameZh: "成长树型",
    category: "path_map",
    suitableFor: "长期积累 / 根基→成果",
    recommendedRoles: ["content"],
    layoutEnglish: `Layout: large illustrated tree rooted at the bottom of the card, growing upward
with a thick trunk and expanding branches. The roots represent foundations;
the trunk represents core principles; branches and leaves represent outcomes
or skills. Labels are embedded in each section of the tree.`,
  },
];

// ─────────────────────────── §2.3.1 封面 / 收尾构图 ───────────────────────────

const COVERS: Composition[] = [
  {
    id: "centered_quote_seal",
    nameZh: "居中印章引言",
    category: "cover",
    suitableFor: "内容深度型（读书/思考）",
    recommendedRoles: ["cover"],
    layoutEnglish: `Layout: centered hero quote in large serif type, occupying the upper 60% of
the card. A traditional seal stamp or decorative emblem placed below or beside
the quote. Author or source attribution in smaller text at the bottom.`,
  },
  {
    id: "hero_title",
    nameZh: "大字主标题",
    category: "cover",
    suitableFor: "干货/教程型，强信息",
    recommendedRoles: ["cover"],
    layoutEnglish: `Layout: oversized headline taking 50-70% of card area, with strong visual
weight (bold sans-serif or display type). 1-2 line subtitle below in
contrasting weight. Optional accent shape (geometric block / underline) for emphasis.`,
  },
  {
    id: "bold_headline",
    nameZh: "粗体大标题 + 副标题",
    category: "cover",
    suitableFor: "商务/职场/通用",
    recommendedRoles: ["cover"],
    layoutEnglish: `Layout: confident bold headline at upper third, large but not overwhelming.
Subtitle in 2-3 lines below. Bottom third reserved for visual element
(illustration, photo, or color block) representing the topic.`,
  },
  {
    id: "magazine_cover",
    nameZh: "杂志封面型",
    category: "cover",
    suitableFor: "复古杂志风格专属",
    recommendedRoles: ["cover"],
    layoutEnglish: `Layout: editorial magazine cover style with masthead-style title at top,
large feature image in middle 60%, and tagline + issue marker at bottom.
Typography mixes serif display with sans-serif accents.`,
  },
];

const CLOSINGS: Composition[] = [
  {
    id: "action_card",
    nameZh: "行动清单型",
    category: "closing",
    suitableFor: "干货收尾，给出 3-5 行动项",
    recommendedRoles: ["closing"],
    layoutEnglish: `Layout: vertical card with a strong "ACTION" or "立刻行动" header at top.
Below, 3 to 5 numbered or checkmarked action items, each starting with a
verb. Each item gets equal visual weight. Bottom: optional brand mark.`,
  },
  {
    id: "closing_summary",
    nameZh: "总结回顾型",
    category: "closing",
    suitableFor: "要点回顾，方便收藏",
    recommendedRoles: ["closing"],
    layoutEnglish: `Layout: "本期回顾 / KEY TAKEAWAYS" header at top in distinctive style.
3 to 5 condensed summary points below, each with a small icon or number.
Visual rhythm should feel decisive and memorable, encouraging save/bookmark.`,
  },
  {
    id: "cta_share",
    nameZh: "互动召唤型",
    category: "closing",
    suitableFor: "社媒互动（@闺蜜 / 评论区聊聊）",
    recommendedRoles: ["closing"],
    layoutEnglish: `Layout: prominent call-to-action message at center (转发 / 收藏 / 评论 prompt).
Surrounded by social interaction icons (heart / message / save). Visual energy: warm and inviting.`,
  },
];

// ─────────────────────────── 汇总导出 ───────────────────────────

/** 30 种正文构图（6 类 × 5）— SPEC §2.3 */
export const CONTENT_COMPOSITIONS: Composition[] = [
  ...LINEAR_FLOW,
  ...HIERARCHY,
  ...CIRCULAR,
  ...COMPARISON,
  ...CONTAINER,
  ...PATH_MAP,
];

/** 4 种封面构图 — SPEC §2.3.1 */
export const COVER_COMPOSITIONS: Composition[] = COVERS;

/** 3 种收尾构图 — SPEC §2.3.1 */
export const CLOSING_COMPOSITIONS: Composition[] = CLOSINGS;

/** 全表（按 SPEC 顺序）— 30 + 4 + 3 = 37 */
export const ALL_COMPOSITIONS: Composition[] = [
  ...CONTENT_COMPOSITIONS,
  ...COVER_COMPOSITIONS,
  ...CLOSING_COMPOSITIONS,
];

/** id → record 索引（O(1) 查找） */
const INDEX: Record<CompositionId, Composition> = ALL_COMPOSITIONS.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CompositionId, Composition>,
);

/** 取一个构图记录；id 不存在抛错（agent 输出 id 必须在白名单内） */
export function getComposition(id: CompositionId): Composition {
  const c = INDEX[id];
  if (!c) throw new Error(`composition id 不在白名单：${id}`);
  return c;
}

/** 拼装 prompt 用：取英文 layout 描述 */
export function getCompositionLayout(id: CompositionId): string {
  return getComposition(id).layoutEnglish;
}

// ─────────────────────────── §2.3.2 选择规则 ───────────────────────────

/** 6 大类对应的中文形态信号关键词（SPEC §2.3 大类索引"内容形态信号"列）*/
const CATEGORY_SIGNALS: Record<
  Exclude<CompositionCategory, "cover" | "closing">,
  string[]
> = {
  linear_flow: ["第", "步", "接着", "然后", "最后", "首先", "之后", "顺序"],
  hierarchy: ["分为", "层", "表层", "深层", "因果", "原因", "类", "维度"],
  circular: ["核心", "周边", "循环", "持续", "围绕", "中心", "环绕"],
  comparison: ["vs", "对比", "区别", "种", "清单", "差异", "并列", "VS"],
  container: ["笔记", "卷轴", "手机", "便签", "屏幕", "App", "宣言"],
  path_map: ["成长", "路径", "进阶", "从", "到", "目标", "规划", "阶段"],
};

/**
 * SPEC §2.3.2 规则 d — 比例不兼容黑名单
 * 1:1 全部兼容（不在表内即代表全兼容）
 */
const RATIO_AVOID: Record<string, CompositionId[]> = {
  // 9:16 慎用 split_left_right（左右太挤）
  "9:16": ["split_left_right"],
  // 16:9 / 3:2 慎用纵向类（vertical_timeline / mountain_climb 等）
  "16:9": [
    "vertical_timeline",
    "mountain_climb",
    "metro_line",
    "growth_tree",
    "winding_path",
    "staircase",
    "river_confluence",
  ],
  "3:2": [
    "vertical_timeline",
    "mountain_climb",
    "metro_line",
    "growth_tree",
    "winding_path",
  ],
};

/** SPEC §2.3 头注：长尾 fallback 用 bento_layout；当前 30 主表里 masonry_2col 最接近 bento，作为 fallback */
const CONTENT_FALLBACK: CompositionId = "stacked_cards";

export interface SelectCompositionInput {
  /** 卡片角色 */
  role: CompositionRole;
  /** 卡片 1-based 序号；可省略 — agent 在 outline 阶段并不一定有 index */
  index?: number;
  /** 总卡片数；可省略 */
  total?: number;
  /** 卡片关键文字（key_text / title 等）— 用于匹配 §2.3.2 规则 a 的形态信号 */
  contentSignals?: string;
  /** 画幅比例 — 用于规则 d；不传按 1:1 处理 */
  ratio?: string;
  /**
   * §2.3.2 规则 c — 风格偏好。
   * SPEC 文末"详见 §2.4 风格 schema 的 preferredCompositions 字段"，由 §2.4 落地后由 caller 注入。
   */
  styleHints?: {
    preferred?: CompositionId[];
    avoid?: CompositionId[];
  };
  /**
   * §2.3.2 规则 b — 不连续重复。caller 传入"前一两张"已用 id，selector 会避开。
   */
  recentlyUsed?: CompositionId[];
}

/**
 * SPEC §2.3.2 — agent 选构图主入口。
 *
 * 优先级（高 → 低）：
 *  1. role=cover → 在 4 个封面构图中按 styleHints.preferred 优先 / 否则 hero_title
 *  2. role=closing → 在 3 个收尾构图中按 styleHints.preferred 优先 / 否则 closing_summary
 *  3. role=content：
 *     a. 内容形态信号匹配大类 → 该大类内按 styleHints.preferred → recent 规避 → 第 1 个
 *     b. 没匹配上 → fallback `stacked_cards`（最通用）
 *     d. 始终用 RATIO_AVOID 黑名单过滤；过滤后空 → 退而求其次（保留首个被过滤的）
 *
 * 该函数纯函数，无副作用。Agent 在 §2.6.1 outline 输出时调用。
 */
export function selectComposition(input: SelectCompositionInput): CompositionId {
  const { role, contentSignals = "", ratio, styleHints, recentlyUsed = [] } = input;

  // 候选池
  let pool: Composition[];
  if (role === "cover") {
    pool = COVER_COMPOSITIONS;
  } else if (role === "closing") {
    pool = CLOSING_COMPOSITIONS;
  } else {
    // 规则 a：先匹配形态信号
    const matchedCategory = matchCategoryBySignals(contentSignals);
    pool = matchedCategory
      ? CONTENT_COMPOSITIONS.filter((c) => c.category === matchedCategory)
      : [...CONTENT_COMPOSITIONS]; // 没匹配上用全 30 池
  }

  // 规则 d：比例黑名单过滤（仅 content 适用；cover/closing 一般 cover 都竖排兼容）
  let filtered = pool;
  if (ratio && RATIO_AVOID[ratio]) {
    const avoid = new Set(RATIO_AVOID[ratio]);
    const next = pool.filter((c) => !avoid.has(c.id));
    if (next.length > 0) filtered = next;
    // 若全部被过滤，保留原 pool（极端情况，不应发生）
  }

  // 规则 c：styleHints.avoid 过滤
  if (styleHints?.avoid?.length) {
    const avoid = new Set(styleHints.avoid);
    const next = filtered.filter((c) => !avoid.has(c.id));
    if (next.length > 0) filtered = next;
  }

  // 规则 b：去掉最近用过的；如果全部用过也只能放弃这条规则
  if (recentlyUsed.length) {
    const recent = new Set(recentlyUsed);
    const next = filtered.filter((c) => !recent.has(c.id));
    if (next.length > 0) filtered = next;
  }

  // 规则 c 优先：在剩余池里优先取风格 preferred
  if (styleHints?.preferred?.length) {
    const preferred = filtered.find((c) => styleHints.preferred!.includes(c.id));
    if (preferred) return preferred.id;
  }

  // 取第一个；空池兜底
  if (filtered.length > 0) return filtered[0].id;
  return role === "content" ? CONTENT_FALLBACK : pool[0].id;
}

/** 内容形态信号 → 大类匹配；按命中关键词数量取最高分大类 */
function matchCategoryBySignals(
  text: string,
): Exclude<CompositionCategory, "cover" | "closing"> | null {
  if (!text) return null;
  const lower = text;
  let bestCat: Exclude<CompositionCategory, "cover" | "closing"> | null = null;
  let bestScore = 0;

  (Object.keys(CATEGORY_SIGNALS) as Array<
    Exclude<CompositionCategory, "cover" | "closing">
  >).forEach((cat) => {
    const score = CATEGORY_SIGNALS[cat].reduce(
      (n, kw) => (lower.includes(kw) ? n + 1 : n),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  });

  return bestScore > 0 ? bestCat : null;
}
