"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// 2026-05-06 修:image niche 类型(封面/海报/插画)用独立 key,不再凑数 culture/travel/beauty
// 2026-05-09 PR4:slides 新增 8 大分类(商务/编辑/工作室/品牌/复古/教育/科技/海报),
// 收编 74 个 slides 模板。原 cards 占位 niche(职场/理财/...)保留兜底,后续 cards
// 模块重做时会清掉。"海报"既被 slides(海报宣言模板)又被 image 用,共用同一 i18n key。
const NICHE_LABEL_KEY: Record<string, string> = {
  "全部": "templateGrid.filterAll",
  // ─── PR4 slides 新 8 分类 ───
  "商务": "templateGrid.nicheBusiness",
  "编辑": "templateGrid.nicheEditorial",
  "工作室": "templateGrid.nicheStudio",
  "品牌": "templateGrid.nicheLifestyle",
  "复古": "templateGrid.nicheRetro",
  "教育": "templateGrid.nicheEducation",
  "科技": "templateGrid.nicheTech",
  "创意": "templateGrid.nicheCreative",
  "生活": "templateGrid.nicheLife",
  "媒体": "templateGrid.nicheMedia",
  "营销": "templateGrid.nicheMarketing",
  "产品": "templateGrid.nicheProduct",
  "杂志": "templateGrid.nicheMagazine",
  // ─── 旧 cards 占位 niche(后续 cards 重做时清理)───
  "职场": "templateGrid.nicheCareer",
  "理财": "templateGrid.nicheFinance",
  "读书": "templateGrid.nicheReading",
  "美妆": "templateGrid.nicheBeauty",
  "健康": "templateGrid.nicheHealth",
  "国风": "templateGrid.nicheCulture",
  "旅行": "templateGrid.nicheTravel",
  // ─── image / slides 海报共用 ───
  "封面": "templateGrid.nicheCover",
  "海报": "templateGrid.nichePoster",
  "插画": "templateGrid.nicheIllustration",
};
const TEMPLATE_MODE_KEY: Record<"cards" | "slides" | "image", string> = {
  cards: "modes.cards",
  slides: "modes.slides",
  image: "modes.image",
};

/** 硬编码占位符模板 id 白名单(对应 messages/{locale}.json 的 templates.* 节点)。
 *  在白名单里 → 走 t();不在(DB 真模板)→ 用原 title 字段。 */
const LOCALIZED_TEMPLATE_IDS = new Set<string>([
  "card-career-method", "card-career-star", "card-finance-wealth", "card-finance-plan",
  "card-reading-quote", "card-reading-mind", "card-beauty-skin", "card-beauty-routine",
  "card-wellness-habit", "card-wellness-food", "card-culture-ink", "card-culture-solar",
  "card-travel-route", "card-travel-photo", "card-wellness-sleep", "card-career-growth",
  "card-travel-local",
  "career-playbook", "career-interview", "career-weekly", "finance-risk", "finance-budget",
  "finance-cashflow", "reading-notes", "reading-framework", "reading-output",
  "beauty-review", "beauty-routine", "wellness-sleep", "wellness-food", "wellness-habit",
  "culture-song", "culture-festival", "travel-kyoto", "travel-photo",
  "img-career-cover", "img-quote-warm", "img-finance-poster", "img-beauty-cover",
  "img-wellness-poster", "img-culture-illus", "img-travel-cover", "img-reading-illus",
  "img-career-poster", "img-festival-illus", "img-beauty-poster", "img-finance-cover",
  "img-photo-cover", "img-wellness-illus", "img-culture-poster", "img-cashflow-cover",
  "img-travel-poster", "img-reading-poster",
]);

export type Template = {
  id: string;
  title: string;
  niche: string;
  uses: string;
  thumbClass: string;
  headline: string;
  subhead?: string;
  imageSrc?: string;
  mode: "cards" | "slides" | "image";
  /** true 表示来自 templates 表,提交任务时可以安全带 template_id */
  dbBacked?: boolean;
  /**
   * M5+ 模板矩阵化(SPEC §3.5 / Phase2 T2-30 项目核心价值):
   * 用户点模板 → 自动注入 promptSeed + 锁定 style/ratio/generationMode
   * 不是简单"放一张缩略图占位",而是把整套设计骨架打包给用户
   */
  /** 通用提示词骨架,带 {user_content} / {user_intent} 占位符 */
  promptSeed?: string;
  /** 锁定的风格 id(对应 src/lib/styles/*.ts) */
  lockedStyleId?: string;
  /** 锁定的比例 */
  lockedRatio?: string;
  /** slides 专属:锁定 L1(batch) / L2(one-by-one) 输出方式 */
  lockedGenerationMode?: "batch" | "one-by-one";
  /** 简短一句话描述,模板介绍区域用 */
  oneLiner?: string;
};

type TemplateGridProps = {
  onPreview: (template: Template) => void;
  activeMode?: TemplateMode;
  onModeChange?: (mode: TemplateMode) => void;
};

type TemplateMode = "cards" | "slides" | "image";

const cardNiches = ["全部", "Editorial", "Swiss"];
// 2026-05-09 PR4:slides 分类按 74 个真实模板的视觉 + 场景特征重新归类。
// 顺序按"高频→低频"+ 视觉相邻原则:商务/编辑放前面(用户最常用),
// 海报放最后(只有 3 个)。
const slideNiches = ["全部", "商务", "编辑", "工作室", "品牌", "复古", "教育", "科技", "海报"];
const imageNiches = ["全部", "封面", "海报", "插画"];
const LEGACY_CARD_TEMPLATE_IDS = new Set(["cards-xhs-fresh-book-quote"]);
const ALL_NICHE = "全部";

const cardTemplates: Template[] = [
  {
    id: "guizang-editorial-ink-classic",
    title: "Guizang Editorial · Ink Classic",
    niche: "Editorial",
    uses: "0 uses",
    thumbClass: "as-theme-gz-editorial-ink",
    headline: "Ink Classic",
    subhead: "M01-M16 · magazine recipes",
    mode: "cards",
    lockedStyleId: "vintage_magazine",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "Guizang Editorial Magazine × E-ink 默认主题,适合商业评论、AI 笔记、产品思考。",
    promptSeed: `使用 Guizang Social Card Skill 的 Editorial Magazine × E-ink 种子模板,主题 Ink Classic。

【用户内容】
{user_content}

【版式路由】
- 从 Editorial recipes M01-M16 中按内容自动选 5-9 页
- 封面优先 M01 Magazine Issue Cover；观点页优先 M03/M04/M08/M11；有证据图时用 M10；结尾用 M07
- 每页只讲一个观点,保持杂志 feature 的节奏

【视觉】
- 3:4 小红书图文笔记
- paper: #f3f0e8, ink: #0a0a0b, accent: #111111
- serif/Songti display, paper grain / ink wash atmosphere, hairline rules, ledger / marginalia / pull quote
- 不要做成普通信息图卡片,不要粗黑大标题,不要渐变球装饰`,
  },
  {
    id: "guizang-editorial-indigo-porcelain",
    title: "Guizang Editorial · Indigo Porcelain",
    niche: "Editorial",
    uses: "0 uses",
    thumbClass: "as-theme-gz-editorial-indigo",
    headline: "Indigo Porcelain",
    subhead: "tech · research · calm writing",
    mode: "cards",
    lockedStyleId: "vintage_magazine",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "冷静的靛蓝瓷主题,适合技术研究、AI 基础设施、数据分析类长文。",
    promptSeed: `使用 Guizang Social Card Skill 的 Editorial Magazine × E-ink 种子模板,主题 Indigo Porcelain。

【用户内容】
{user_content}

【版式路由】
- 从 Editorial recipes M01-M16 中按内容自动选 5-9 页
- 技术解释页优先 M03/M08/M10/M11,中段可穿插 M04 Pull Quote
- 有截图或证据时让图片/截图占据 45%-65% 高度

【视觉】
- 3:4 小红书图文笔记
- paper: #f2f4f5, ink: #0a1f3d, accent: #315d93
- serif/Songti display, 克制杂志排版,蓝灰纸感,细线与边注
- 不要使用通用蓝色科技渐变背景`,
  },
  {
    id: "guizang-editorial-forest-ink",
    title: "Guizang Editorial · Forest Ink",
    niche: "Editorial",
    uses: "0 uses",
    thumbClass: "as-theme-gz-editorial-forest",
    headline: "Forest Ink",
    subhead: "field notes · nature · grounded",
    mode: "cards",
    lockedStyleId: "vintage_magazine",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "森林墨主题,适合户外、自然、可持续、生活观察与 grounded lifestyle。",
    promptSeed: `使用 Guizang Social Card Skill 的 Editorial Magazine × E-ink 种子模板,主题 Forest Ink。

【用户内容】
{user_content}

【版式路由】
- 从 Editorial recipes M01-M16 中按内容自动选 5-9 页
- 观察/生活页优先 M02 Field Note Photo / M11 Marginalia Essay / M08 Tall Ledger
- 封面用 M01,如果用户给了高质量照片可用 M16 Image-Led Cover

【视觉】
- 3:4 小红书图文笔记
- paper: #f5f1e8, ink: #16251b, accent: #2e6b4f
- paper grain, field-note caption, 低饱和绿色强调,杂志式留白
- 不要做成普通治愈系贴纸卡`,
  },
  {
    id: "guizang-editorial-kraft-paper",
    title: "Guizang Editorial · Kraft Paper",
    niche: "Editorial",
    uses: "0 uses",
    thumbClass: "as-theme-gz-editorial-kraft",
    headline: "Kraft Paper",
    subhead: "memory · craft · creator notes",
    mode: "cards",
    lockedStyleId: "vintage_magazine",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "牛皮纸主题,适合怀旧、人文、阅读、手作、创作者笔记。",
    promptSeed: `使用 Guizang Social Card Skill 的 Editorial Magazine × E-ink 种子模板,主题 Kraft Paper。

【用户内容】
{user_content}

【版式路由】
- 从 Editorial recipes M01-M16 中按内容自动选 5-9 页
- 阅读/创作者笔记优先 M01/M03/M04/M08/M11/M07
- 每页保留 issue label / marginalia / hairline,让内容像一篇被拆开的杂志专栏

【视觉】
- 3:4 小红书图文笔记
- paper: #eedfc7, ink: #2a1e13, accent: #9b5a2e
- 牛皮纸、做旧纸感、衬线标题、边注与编号
- 不要做成咖啡色营销海报`,
  },
  {
    id: "guizang-editorial-dune",
    title: "Guizang Editorial · Dune",
    niche: "Editorial",
    uses: "0 uses",
    thumbClass: "as-theme-gz-editorial-dune",
    headline: "Dune",
    subhead: "design · objects · gallery tone",
    mode: "cards",
    lockedStyleId: "vintage_magazine",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "沙丘主题,适合设计、作品集、物件研究、创意与审美类内容。",
    promptSeed: `使用 Guizang Social Card Skill 的 Editorial Magazine × E-ink 种子模板,主题 Dune。

【用户内容】
{user_content}

【版式路由】
- 从 Editorial recipes M01-M16 中按内容自动选 5-9 页
- 设计/作品页优先 M01/M02/M10/M11/M16,观点页用 M04/M08
- 有图时图像是证据层,不要当装饰小图

【视觉】
- 3:4 小红书图文笔记
- paper: #f0e6d2, ink: #1f1a14, accent: #8f7650
- gallery tone, warm sand paper, quiet serif, large image well / marginalia
- 避免廉价 beige 模板感`,
  },
  {
    id: "guizang-editorial-midnight-ink",
    title: "Guizang Editorial · Midnight Ink",
    niche: "Editorial",
    uses: "0 uses",
    thumbClass: "as-theme-gz-editorial-midnight",
    headline: "Midnight Ink",
    subhead: "dark editorial · cinematic",
    mode: "cards",
    lockedStyleId: "vintage_magazine",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "官方唯一暗色 Editorial palette,适合夜景、游戏 key art、影视、深色文化题材。",
    promptSeed: `使用 Guizang Social Card Skill 的 Editorial Magazine × E-ink 种子模板,主题 Midnight Ink。

【用户内容】
{user_content}

【版式路由】
- 从 Editorial recipes M01-M16 中按内容自动选 5-9 页
- 暗色封面可用 M16/M01,正文页用 M04/M08/M10/M11/M07
- Midnight Ink 只用于适合暗色的内容,不要把所有页面做成黑底卡片堆

【视觉】
- 3:4 小红书图文笔记
- paper: #0e0d0c, ink: #ece2cf, accent: #d4a04a
- 暗色纸感、暖金强调、photo bleed / ink atmosphere
- 不要自造其他暗色 palette,不要堆不透明卡片`,
  },
  {
    id: "guizang-swiss-ikb-blue",
    title: "Guizang Swiss · IKB Blue",
    niche: "Swiss",
    uses: "0 uses",
    thumbClass: "as-theme-gz-swiss-ikb",
    headline: "IKB BLUE",
    subhead: "S01-S12 · grid recipes",
    mode: "cards",
    lockedStyleId: "minimal_whitespace",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "Swiss 默认锚点色,适合 AI 产品、方法论、商业发布、工程笔记。",
    promptSeed: `使用 Guizang Social Card Skill 的 Swiss International 种子模板,accent IKB Blue。

【用户内容】
{user_content}

【版式路由】
- 从 Swiss recipes S01-S12 中按内容自动选 5-9 页
- 封面优先 S01 Accent Cover；对比用 S02；数据/文件卡用 S03；截图教程用 S04；流程/架构用 S06；总结用 S07/S11/S12

【视觉】
- 3:4 小红书图文笔记
- paper: #fafaf8, ink: #0a0a0a, accent: #002FA7
- 严格左对齐网格、发丝线、单一高饱和锚点色、大字号低字重
- 不要渐变、阴影、玻璃拟态、混合多色 accent`,
  },
  {
    id: "guizang-swiss-lemon-yellow",
    title: "Guizang Swiss · Lemon Yellow",
    niche: "Swiss",
    uses: "0 uses",
    thumbClass: "as-theme-gz-swiss-yellow",
    headline: "LEMON",
    subhead: "consumer · active · retail",
    mode: "cards",
    lockedStyleId: "minimal_whitespace",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "柠檬黄锚点色,适合年轻、运动、零售、消费品和轻快信息。",
    promptSeed: `使用 Guizang Social Card Skill 的 Swiss International 种子模板,accent Lemon Yellow。

【用户内容】
{user_content}

【版式路由】
- 从 Swiss recipes S01-S12 中按内容自动选 5-9 页
- 快速信息优先 S01/S02/S05/S07/S11,数据页用 S09/S10/S12

【视觉】
- 3:4 小红书图文笔记
- paper: #fafaf8, ink: #0a0a0a, accent: #FFD500, accent-on: #0a0a0a
- 严格网格、发丝线、黑字黄块、高对比信息组织
- 不要把黄色做成渐变或装饰背景`,
  },
  {
    id: "guizang-swiss-lemon-green",
    title: "Guizang Swiss · Lemon Green",
    niche: "Swiss",
    uses: "0 uses",
    thumbClass: "as-theme-gz-swiss-green",
    headline: "GREEN",
    subhead: "future · ecology · health",
    mode: "cards",
    lockedStyleId: "minimal_whitespace",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "柠檬绿锚点色,适合生态、健康、新兴科技、Z 世代和 highlighter 感内容。",
    promptSeed: `使用 Guizang Social Card Skill 的 Swiss International 种子模板,accent Lemon Green。

【用户内容】
{user_content}

【版式路由】
- 从 Swiss recipes S01-S12 中按内容自动选 5-9 页
- 健康/趋势/科技解释优先 S01/S03/S07/S09/S10/S12

【视觉】
- 3:4 小红书图文笔记
- paper: #fafaf8, ink: #0a0a0a, accent: #C5E803, accent-on: #0a0a0a
- strict grid, card-fill matrix, KPI tower, h-bar chart, hairline rules
- 不要柔和治愈系插画,保持工程化信息感`,
  },
  {
    id: "guizang-swiss-safety-orange",
    title: "Guizang Swiss · Safety Orange",
    niche: "Swiss",
    uses: "0 uses",
    thumbClass: "as-theme-gz-swiss-orange",
    headline: "SAFETY",
    subhead: "warning · urgency · decision",
    mode: "cards",
    lockedStyleId: "minimal_whitespace",
    lockedRatio: "3:4",
    lockedGenerationMode: "one-by-one",
    oneLiner: "安全橙锚点色,适合警示、风险、工业、新闻和决策点内容。",
    promptSeed: `使用 Guizang Social Card Skill 的 Swiss International 种子模板,accent Safety Orange。

【用户内容】
{user_content}

【版式路由】
- 从 Swiss recipes S01-S12 中按内容自动选 5-9 页
- 风险/警示页优先 S05 Trap Rows / S10 H-Bar / S11 Stacked Ledger,封面用 S01

【视觉】
- 3:4 小红书图文笔记
- paper: #fafaf8, ink: #0a0a0a, accent: #FF6B35, accent-on: #ffffff
- 高对比、黑橙警示、直角块、发丝线、强结构
- 不要做成橙色营销海报`,
  },
];

const slideTemplates: Template[] = [
  {
    id: "career-playbook",
    title: "商务汇报·三幕式(modern_pro)",
    niche: "职场",
    uses: "4,129 uses",
    thumbClass: "as-theme-business",
    headline: "2026 Career Playbook",
    subhead: "problem · solution · action",
    mode: "slides",
    // 完整模板骨架(M5+ 矩阵化首批 6 模板之一)
    lockedStyleId: "modern_pro",
    lockedRatio: "16:9",
    lockedGenerationMode: "batch", // L1 HTML
    oneLiner: "现代专业商务风,深蓝主色 + 玫瑰金高亮,适合季度复盘 / 战略提案 / 客户演讲",
    promptSeed: `做一份 8 页商务演讲 deck,采用三幕式结构(问题 → 方案 → 行动)。

【主题】请填入你的具体主题:
{user_content}

【受众】CTO / 产品负责人 / 业务决策层

【结构】
1. 封面 — 标题 + 副标题 + 演讲人位
2. 议程页 — 列 3 大要点 + 总结 + Q&A
3. 章节标题 — "问题 1:[现象]"
4. 内容页 — 现象 + 数据 + 应对建议(用 callout 高亮关键数据)
5. 章节标题 — "问题 2:[现象]"
6. 内容页 — 案例 + bad/good 对比
7. 章节标题 — "问题 3:[现象]"
8. 总结 + Q&A 页 — 3 句话总结 + 3 个行动建议

【视觉规范】
- 风格:现代专业(modern_pro)
- 主色:深蓝 #0B2F5A
- 高亮:玫瑰金 #E5B375(关键数字 + 重点词)
- 留白充足,标题靠上,数据居中
- 每页右下角显示页码 + 章节名

【可补充】用户对内容的额外说明(可选):
{user_intent}`,
  },
  { id: "career-interview", title: "面试复盘结构", niche: "职场", uses: "788 uses", thumbClass: "as-theme-interview", headline: "Interview Review", subhead: "STAR · impact · next", mode: "slides" },
  { id: "career-weekly", title: "周报复盘结构", niche: "职场", uses: "1,624 uses", thumbClass: "as-theme-weekly", headline: "Weekly Review", subhead: "wins / blockers / next", mode: "slides" },
  { id: "finance-risk", title: "理财风险提示", niche: "理财", uses: "2,384 uses", thumbClass: "as-theme-finance", headline: "Risk First", subhead: "cashflow · asset · plan", mode: "slides" },
  { id: "finance-budget", title: "月度预算规划", niche: "理财", uses: "2,751 uses", thumbClass: "as-theme-budget", headline: "Budget Map", subhead: "spend less, save clear", mode: "slides" },
  { id: "finance-cashflow", title: "家庭现金流盘点", niche: "理财", uses: "1,891 uses", thumbClass: "as-theme-cashflow", headline: "Cashflow Plan", subhead: "income · expense · buffer", mode: "slides" },
  { id: "reading-notes", title: "读书金句手账", niche: "读书", uses: "6,859 uses", thumbClass: "as-theme-reading", headline: "Reading Notes", subhead: "quotes and insight", mode: "slides" },
  { id: "reading-framework", title: "一本书拆解框架", niche: "读书", uses: "5,264 uses", thumbClass: "as-theme-framework", headline: "Book Breakdown", subhead: "idea / evidence / action", mode: "slides" },
  { id: "reading-output", title: "读书输出计划", niche: "读书", uses: "3,420 uses", thumbClass: "as-theme-output", headline: "Output Map", subhead: "note / idea / publish", mode: "slides" },
  { id: "beauty-review", title: "美妆成分解析", niche: "美妆", uses: "1,905 uses", thumbClass: "as-theme-beauty", headline: "Glow Routine", subhead: "ingredients / steps / result", mode: "slides" },
  { id: "beauty-routine", title: "护肤步骤教程", niche: "美妆", uses: "2,146 uses", thumbClass: "as-theme-routine", headline: "AM Routine", subhead: "cleanse · repair · protect", mode: "slides" },
  { id: "wellness-sleep", title: "睡眠质量提升清单", niche: "健康", uses: "1,442 uses", thumbClass: "as-theme-wellness", headline: "Better Sleep", subhead: "small habits that work", mode: "slides" },
  { id: "wellness-food", title: "养生食谱卡", niche: "健康", uses: "1,335 uses", thumbClass: "as-theme-food", headline: "Seasonal Food", subhead: "gentle wellness notes", mode: "slides" },
  { id: "wellness-habit", title: "健康习惯打卡", niche: "健康", uses: "1,208 uses", thumbClass: "as-theme-habit", headline: "Habit Reset", subhead: "sleep · food · movement", mode: "slides" },
  { id: "culture-song", title: "宋代美学图鉴", niche: "国风", uses: "932 uses", thumbClass: "as-theme-culture", headline: "宋代美学", subhead: "器物 · 色彩 · 秩序", mode: "slides" },
  { id: "culture-festival", title: "节气文化解释", niche: "国风", uses: "1,062 uses", thumbClass: "as-theme-festival", headline: "二十四节气", subhead: "time, weather, ritual", mode: "slides" },
  { id: "travel-kyoto", title: "旅行路线图文攻略", niche: "旅行", uses: "3,018 uses", thumbClass: "as-theme-travel", headline: "Kyoto Weekend", subhead: "route / food / photo spots", mode: "slides" },
  { id: "travel-photo", title: "摄影旅行清单", niche: "旅行", uses: "476 uses", thumbClass: "as-theme-photo", headline: "Photo Walk", subhead: "light / frame / story", mode: "slides" },
];

const imageTemplates: Template[] = [
  { id: "img-career-cover", title: "AI 改变工作方式·商务封面", niche: "封面", uses: "2,340 uses", thumbClass: "as-theme-business", headline: "Career Cover", subhead: "title · role · brand", imageSrc: "/templates/img-career-cover.png", mode: "image" },
  { id: "img-quote-warm", title: "金句分享图", niche: "封面", uses: "4,182 uses", thumbClass: "as-theme-reading", headline: "Quote Card", subhead: "words · mood · share", mode: "image" },
  { id: "img-finance-poster", title: "理财知识海报", niche: "海报", uses: "1,654 uses", thumbClass: "as-theme-finance", headline: "Money Poster", subhead: "insight · data · clear", mode: "image" },
  { id: "img-beauty-cover", title: "美妆封面图", niche: "封面", uses: "2,891 uses", thumbClass: "as-theme-beauty", headline: "Beauty Cover", subhead: "glow · tone · style", mode: "image" },
  { id: "img-wellness-poster", title: "健康养生海报", niche: "海报", uses: "1,120 uses", thumbClass: "as-theme-wellness", headline: "Wellness Art", subhead: "balance · nature · calm", mode: "image" },
  { id: "img-culture-illus", title: "西湖龙井·中式水墨", niche: "插画", uses: "1,024 uses", thumbClass: "as-theme-culture", headline: "墨韵", subhead: "意境 · 留白 · 东方", imageSrc: "/templates/img-culture-illus.png", mode: "image" },
  { id: "img-travel-cover", title: "旅行封面图", niche: "封面", uses: "3,012 uses", thumbClass: "as-theme-travel", headline: "Travel Cover", subhead: "place · vibe · explore", mode: "image" },
  { id: "img-reading-illus", title: "读书推荐图", niche: "插画", uses: "2,234 uses", thumbClass: "as-theme-framework", headline: "Book Pick", subhead: "cover · quote · mood", mode: "image" },
  { id: "img-career-poster", title: "复盘比努力更重要·极简金句", niche: "海报", uses: "2,148 uses", thumbClass: "as-theme-interview", headline: "Work Poster", subhead: "tips · method · grow", imageSrc: "/templates/img-career-poster.png", mode: "image" },
  { id: "img-festival-illus", title: "立夏·万物秀实", niche: "插画", uses: "1,332 uses", thumbClass: "as-theme-festival", headline: "节气图", subhead: "时令 · 气候 · 美感", imageSrc: "/templates/img-festival-illus.png", mode: "image" },
  { id: "img-beauty-poster", title: "护肤海报", niche: "海报", uses: "1,733 uses", thumbClass: "as-theme-routine", headline: "Skin Poster", subhead: "ingredient · care · glow", mode: "image" },
  { id: "img-finance-cover", title: "财富知识封面", niche: "封面", uses: "988 uses", thumbClass: "as-theme-budget", headline: "Wealth Cover", subhead: "asset · goal · plan", mode: "image" },
  { id: "img-photo-cover", title: "夜上海·电影摄影", niche: "封面", uses: "1,587 uses", thumbClass: "as-theme-photo", headline: "Photo Cover", subhead: "light · frame · story", imageSrc: "/templates/img-photo-cover.png", mode: "image" },
  { id: "img-wellness-illus", title: "养生插画图", niche: "插画", uses: "892 uses", thumbClass: "as-theme-food", headline: "Wellness Art", subhead: "seasonal · nourish · heal", mode: "image" },
  { id: "img-culture-poster", title: "国风文化海报", niche: "海报", uses: "634 uses", thumbClass: "as-theme-culture", headline: "文化海报", subhead: "传统 · 美学 · 新生", mode: "image" },
  { id: "img-cashflow-cover", title: "现金流封面图", niche: "封面", uses: "541 uses", thumbClass: "as-theme-cashflow", headline: "Cash Cover", subhead: "income · flow · future", mode: "image" },
  { id: "img-travel-poster", title: "旅行攻略海报", niche: "海报", uses: "2,108 uses", thumbClass: "as-theme-travel", headline: "Trip Poster", subhead: "route · stay · eat", mode: "image" },
  { id: "img-reading-poster", title: "读书感悟海报", niche: "海报", uses: "1,567 uses", thumbClass: "as-theme-reading", headline: "Book Poster", subhead: "insight · reflect · share", mode: "image" },
];

function TemplateCard({ template, onPreview }: { template: Template; onPreview: (t: Template) => void }) {
  const t = useTranslations();
  const hasImage = !!template.imageSrc;
  // 模板 title:硬编码占位符的 id 都已在 messages.templates 注册(LOCALIZED_TEMPLATE_IDS),
  // 走 t();DB 真模板的 id 不在白名单 → fallback 用 template.title 原字段
  const titleKey = `templates.${template.id}`;
  const localizedTitle = LOCALIZED_TEMPLATE_IDS.has(template.id)
    ? t(titleKey as never)
    : template.title;
  // niche 同理:已在 NICHE_LABEL_KEY 里的中文走 i18n,DB 自定义 niche fallback 用原值
  const nicheKey = NICHE_LABEL_KEY[template.niche];
  const localizedNiche = nicheKey ? t(nicheKey as never) : template.niche;
  return (
    <article className="as-template-card">
      <button
        className={`as-thumb ${hasImage ? "as-thumb-image" : template.thumbClass}`}
        type="button"
        aria-label={`${t("templateGrid.previewAria")} ${localizedTitle}`}
        onClick={() => onPreview(template)}
        style={
          hasImage
            ? {
                position: "relative",
                overflow: "hidden",
                background: "transparent",
                padding: 0,
              }
            : undefined
        }
      >
        {hasImage ? (
          /* 真图模板:完整展示(object-contain,比例不匹配时居中留白)*/
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={template.imageSrc}
            alt={localizedTitle}
            loading="lazy"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              background: "#f5f4f0",
            }}
          />
        ) : (
          <>
            <strong>{template.headline}</strong>
            {template.subhead ? <span>{template.subhead}</span> : null}
          </>
        )}
      </button>
      <h2>{localizedTitle}</h2>
      <p>
        <span>{localizedNiche}</span>
        {template.uses}
      </p>
    </article>
  );
}

function NichePills({ niches, active, onChange }: { niches: string[]; active: string; onChange: (n: string) => void }) {
  const t = useTranslations();
  return (
    <div className="as-niche-pills">
      {niches.map((n) => {
        const key = NICHE_LABEL_KEY[n];
        return (
          <button key={n} type="button" className={`as-niche-pill${active === n ? " active" : ""}`} onClick={() => onChange(n)}>
            {key ? t(key) : n}
          </button>
        );
      })}
    </div>
  );
}

function availableNiches(preferredOrder: string[], templates: Template[]) {
  const present = new Set(templates.map((template) => template.niche).filter(Boolean));
  const ordered = preferredOrder.filter((niche) => niche === ALL_NICHE || present.has(niche));
  const extras: string[] = [];
  for (const template of templates) {
    if (!template.niche || ordered.includes(template.niche) || extras.includes(template.niche)) continue;
    extras.push(template.niche);
  }
  return [...ordered, ...extras];
}

function TemplateToolbar({
  mode,
  niches,
  activeNiche,
  onNicheChange,
  onModeChange,
}: {
  mode: TemplateMode;
  niches: string[];
  activeNiche: string;
  onNicheChange: (n: string) => void;
  onModeChange: (mode: TemplateMode) => void;
}) {
  const t = useTranslations();
  return (
    <div className="as-template-toolbar">
      <div className="as-mode-switcher">
        {(["cards", "slides", "image"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`as-mode-switch-btn${mode === m ? " active" : ""}`}
            onClick={() => onModeChange(m)}
          >
            {t(TEMPLATE_MODE_KEY[m])}
          </button>
        ))}
      </div>
      <NichePills niches={niches} active={activeNiche} onChange={onNicheChange} />
    </div>
  );
}

export function TemplateGrid({ onPreview, activeMode = "slides", onModeChange }: TemplateGridProps) {
  const [visibleMode, setVisibleMode] = useState<TemplateMode>(activeMode);
  const [cardNiche, setCardNiche] = useState("全部");
  const [slideNiche, setSlideNiche] = useState("全部");
  const [imageNiche, setImageNiche] = useState("全部");
  // M5+ 模板矩阵化:从 /api/templates 拉真实系统模板,而非前端硬编码
  const [dbTemplates, setDbTemplates] = useState<Template[] | null>(null);

  useEffect(() => {
    fetch("/api/templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setDbTemplates(
          ((d.templates ?? []) as Template[]).map((template) => ({
            ...template,
            dbBacked: true,
          })),
        ),
      )
      .catch(() => setDbTemplates([]));
  }, []);

  function handleModeChange(mode: TemplateMode) {
    setVisibleMode(mode);
    onModeChange?.(mode);
  }

  // 模板规则(2026-05-06 修订):三模式都用 DB 优先 + 硬编码占位符 fallback
  //   - cards:DB 真模板 + cardTemplates 占位符(避免 cards 区只有 1 张太空)
  //   - slides:DB 真模板(38 套已够丰富)+ slideTemplates 占位符 fallback
  //   - image:DB + imageTemplates(纯视觉展示)
  // 去重规则(防"两张《纳瓦尔宝典》"那种重复):按 id + imageSrc + title 三重去重
  // 占位符模板没有 promptSeed,点击预览时不能直接生成,但展示密度更好,引导用户尝试三模式
  function mergeDedup(db: Template[], hardcoded: Template[]): Template[] {
    return [
      ...db,
      ...hardcoded.filter(
        (t) =>
          !db.some(
            (d) =>
              d.id === t.id ||
              (t.imageSrc && d.imageSrc === t.imageSrc) ||
              d.title === t.title,
          ),
      ),
    ];
  }
  const dbCards = dbTemplates
    ? dbTemplates.filter((t) => t.mode === "cards" && !LEGACY_CARD_TEMPLATE_IDS.has(t.id))
    : [];
  const allCards = mergeDedup(dbCards, cardTemplates);
  const dbSlides = dbTemplates ? dbTemplates.filter((t) => t.mode === "slides") : [];
  const allSlides = mergeDedup(dbSlides, slideTemplates);
  const dbImages = dbTemplates ? dbTemplates.filter((t) => t.mode === "image") : [];
  const allImages = mergeDedup(dbImages, imageTemplates);

  // 2026-05-17 PR46:过滤掉没有 preview 图的占位模板
  //   - 现有 38 套 slides + 多个 image 模板已经足够,空白卡片浪费首屏
  //   - hardcoded slideTemplates 大多没 imageSrc(纯文字占位),也一并过滤
  //   - DB 模板里 preview_url=null 的同样过滤
  const hasPreview = (t: Template) => !!t.imageSrc || (t.mode === "cards" && !!t.thumbClass);
  const filteredCards = allCards.filter(hasPreview);
  const filteredSlides = allSlides.filter(hasPreview);
  const filteredImages = allImages.filter(hasPreview);

  const availableCardNiches = availableNiches(cardNiches, filteredCards);
  const availableSlideNiches = availableNiches(slideNiches, filteredSlides);
  const availableImageNiches = availableNiches(imageNiches, filteredImages);
  const effectiveCardNiche = availableCardNiches.includes(cardNiche) ? cardNiche : ALL_NICHE;
  const effectiveSlideNiche = availableSlideNiches.includes(slideNiche) ? slideNiche : ALL_NICHE;
  const effectiveImageNiche = availableImageNiches.includes(imageNiche) ? imageNiche : ALL_NICHE;
  const visibleCards = effectiveCardNiche === ALL_NICHE ? filteredCards : filteredCards.filter((t) => t.niche === effectiveCardNiche);
  const visibleSlides = effectiveSlideNiche === ALL_NICHE ? filteredSlides : filteredSlides.filter((t) => t.niche === effectiveSlideNiche);
  const visibleImages = effectiveImageNiche === ALL_NICHE ? filteredImages : filteredImages.filter((t) => t.niche === effectiveImageNiche);

  function renderModeSection(mode: TemplateMode) {
    if (mode === "cards") {
      return (
        <section className="as-mode-section" id="mode-cards">
          <TemplateToolbar
            mode="cards"
            niches={availableCardNiches}
            activeNiche={effectiveCardNiche}
            onNicheChange={setCardNiche}
            onModeChange={handleModeChange}
          />
          <h3 className="sr-only">图文笔记</h3>
          <div className="as-template-grid as-template-grid--cards">
            {visibleCards.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} />)}
          </div>
        </section>
      );
    }

    if (mode === "image") {
      return (
        <section className="as-mode-section" id="mode-image">
          <TemplateToolbar
            mode="image"
            niches={availableImageNiches}
            activeNiche={effectiveImageNiche}
            onNicheChange={setImageNiche}
            onModeChange={handleModeChange}
          />
          <h3 className="sr-only">AI 图片</h3>
          <div className="as-template-grid as-template-grid--image">
            {visibleImages.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} />)}
          </div>
        </section>
      );
    }

    return (
      <section className="as-mode-section" id="mode-slides">
        <TemplateToolbar
          mode="slides"
          niches={availableSlideNiches}
          activeNiche={effectiveSlideNiche}
          onNicheChange={setSlideNiche}
          onModeChange={handleModeChange}
        />
        <h3 className="sr-only">AI 幻灯片</h3>
        <div className="as-template-grid as-template-grid--slides">
          {visibleSlides.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="as-templates" id="templates" aria-label="模板库">
      <span
        hidden
        aria-hidden
        className="as-theme-gz-editorial-ink as-theme-gz-editorial-indigo as-theme-gz-editorial-forest as-theme-gz-editorial-kraft as-theme-gz-editorial-dune as-theme-gz-editorial-midnight as-theme-gz-swiss-ikb as-theme-gz-swiss-yellow as-theme-gz-swiss-green as-theme-gz-swiss-orange"
      />
      {renderModeSection(visibleMode)}
    </section>
  );
}
