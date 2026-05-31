// scripts/import-templates.ts — 从 3 个 MIT 开源仓库抓模板灌进 templates 表
//
// 用法:
//   npx tsx --env-file=.env.local scripts/import-templates.ts
//   npx tsx --env-file=.env.local scripts/import-templates.ts --only=l2  (只跑 L2)
//   npx tsx --env-file=.env.local scripts/import-templates.ts --only=l1  (只跑 L1)
//
// 数据流:
//   gh api … 抓单文件 → 解析 → INSERT/UPDATE templates 表
//   截图(.webp)抓到 public/templates/<id>.webp
//   不留任何残留(不 clone 整仓库,不写 tmp 目录)

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { EXTRA_L2_TEMPLATES } from "./template-specs-extra";

// ─────────────────────── L1 HTML 模板候选 ───────────────────────

interface L1RemoteTemplate {
  kind: "remote";
  id: string;
  name: string;
  niche: string;
  oneLiner: string;
  source: { owner: string; repo: string; htmlPath: string };
  /** guizang 主题色(注入到 LLM prompt,让填充时调主题)*/
  guizangThemeKey?: string;
  thumbClass?: string;
}

interface L1LocalTemplate {
  kind: "local";
  id: string;
  name: string;
  niche: string;
  oneLiner: string;
  /** 相对于 src/lib/slides/templates/ 的路径 */
  localPath: string;
  /** 预览图(已存到 public/templates/<id>.webp);无则跳过 */
  previewLocal?: string;
  thumbClass?: string;
}

type L1Template = L1RemoteTemplate | L1LocalTemplate;

const L1_TEMPLATES: L1Template[] = [
  // 2026-05-21:guizang 2 个模板已删除(JS 填充骨架,无法静态/无头解析出大纲,
  //   长期落兜底路径、无大纲确认环节,体验不一致 → 整体下线)。
  // ── frontend-slides 8 个本地手工合成模板 ──
  {
    kind: "local",
    id: "l1-fs-bold-signal",
    name: "Bold Signal·暗夜聚焦",
    niche: "商务",
    oneLiner: "深色渐变 + 橙色聚焦卡片,Archivo Black 粗黑字体,适合战略发布 / 季度复盘",
    localPath: "frontend-slides/bold-signal.html",
    thumbClass: "as-theme-business",
  },
  {
    kind: "local",
    id: "l1-fs-electric-studio",
    name: "Electric Studio·蓝白工作室",
    niche: "产品",
    oneLiner: "白蓝分屏 + Manrope,品牌角标,适合 SaaS 产品介绍 / 设计提案",
    localPath: "frontend-slides/electric-studio.html",
    thumbClass: "as-theme-tech",
  },
  {
    kind: "local",
    id: "l1-fs-creative-voltage",
    name: "Creative Voltage·电光黄绿",
    niche: "创意",
    oneLiner: "电光蓝 + 霓虹黄 + 半色调网点,Syne 字体,适合创意工作室 / 活动招募",
    localPath: "frontend-slides/creative-voltage.html",
    thumbClass: "as-theme-creative",
  },
  {
    kind: "local",
    id: "l1-fs-dark-botanical",
    name: "Dark Botanical·暖色暗夜",
    niche: "品牌",
    oneLiner: "深色 + 暖金粉,Cormorant 衬线 + 抽象渐变光圈,适合品牌叙事 / 文化品牌",
    localPath: "frontend-slides/dark-botanical.html",
    thumbClass: "as-theme-luxury",
  },
  {
    kind: "local",
    id: "l1-fs-notebook-tabs",
    name: "Notebook Tabs·活页笔记",
    niche: "教育",
    oneLiner: "奶油纸卡 + 彩色侧标签 + 装订孔,Bodoni Moda 衬线,适合培训课件 / 读书会",
    localPath: "frontend-slides/notebook-tabs.html",
    thumbClass: "as-theme-warm",
  },
  {
    kind: "local",
    id: "l1-fs-pastel-geometry",
    name: "Pastel Geometry·糖果几何",
    niche: "生活",
    oneLiner: "白底糖果色 + 圆角几何装饰,Plus Jakarta Sans,适合生活方式 / 个人作品集",
    localPath: "frontend-slides/pastel-geometry.html",
    thumbClass: "as-theme-pink",
  },
  {
    kind: "local",
    id: "l1-fs-split-pastel",
    name: "Split Pastel·分屏糖果",
    niche: "营销",
    oneLiner: "桃粉 / 薰衣草分屏 + 顽皮徽章,Outfit 圆体,适合营销提案 / 活动主视觉",
    localPath: "frontend-slides/split-pastel.html",
    thumbClass: "as-theme-pink",
  },
  {
    kind: "local",
    id: "l1-fs-vintage-editorial",
    name: "Vintage Editorial·复古杂志",
    niche: "媒体",
    oneLiner: "奶油底 + 抽象几何 + Fraunces 复古衬线,适合品牌长文 / 杂志专题",
    localPath: "frontend-slides/vintage-editorial.html",
    thumbClass: "as-theme-warm",
  },
];

// ─────────────────────── L2 baoyu 17 风格 ───────────────────────

interface L2Template {
  id: string;
  baoyuStyleId: string; // 对应 baoyu-skills/skills/baoyu-slide-deck/references/styles/<id>.md
  name: string;
  niche: string;
  oneLiner: string;
}

const L2_TEMPLATES: L2Template[] = [
  { id: "l2-blueprint",            baoyuStyleId: "blueprint",            name: "蓝图工程·技术汇报",     niche: "工程",   oneLiner: "工程蓝图风,网格线 + 技术注解,适合架构设计 / 技术汇报" },
  { id: "l2-bold-editorial",       baoyuStyleId: "bold-editorial",       name: "粗体编辑·杂志头条",     niche: "媒体",   oneLiner: "粗体杂志头条感,极致对比,适合内容发布 / 公关稿" },
  { id: "l2-chalkboard",           baoyuStyleId: "chalkboard",           name: "黑板手绘·教学复盘",     niche: "教育",   oneLiner: "黑板粉笔字,手绘箭头,适合课堂教学 / 知识科普" },
  { id: "l2-corporate",            baoyuStyleId: "corporate",            name: "商务专业·企业汇报",     niche: "商务",   oneLiner: "海军蓝 + 金,结构化网格,适合季度汇报 / 投资人路演 / 客户提案" },
  { id: "l2-dark-atmospheric",     baoyuStyleId: "dark-atmospheric",     name: "深色氛围·电影感",       niche: "品牌",   oneLiner: "深色 + 电影色彩分级,沉浸感强,适合品牌发布 / 产品 launch" },
  { id: "l2-editorial-infographic",baoyuStyleId: "editorial-infographic",name: "信息图杂志·数据故事",   niche: "数据",   oneLiner: "信息图风,数据可视化驱动,适合行业报告 / 趋势洞察" },
  { id: "l2-fantasy-animation",    baoyuStyleId: "fantasy-animation",    name: "奇幻动画·叙事故事",     niche: "创意",   oneLiner: "动画电影感,场景化叙事,适合创意项目 / 儿童内容" },
  { id: "l2-hand-drawn-edu",       baoyuStyleId: "hand-drawn-edu",       name: "手绘教育·亲切讲解",     niche: "教育",   oneLiner: "手绘风教学,亲切感强,适合在线课 / 训练营 / 内训" },
  { id: "l2-intuition-machine",    baoyuStyleId: "intuition-machine",    name: "直觉机器·抽象概念",     niche: "前沿",   oneLiner: "几何抽象,适合 AI / 算法 / 前沿科技概念" },
  { id: "l2-minimal",              baoyuStyleId: "minimal",              name: "极简·留白美学",         niche: "设计",   oneLiner: "极简留白,字体优先,适合 design portfolio / 概念展示" },
  { id: "l2-notion",               baoyuStyleId: "notion",               name: "Notion 风·结构清晰",    niche: "效率",   oneLiner: "Notion 美学,卡片式布局,适合知识管理 / 内部分享" },
  { id: "l2-pixel-art",            baoyuStyleId: "pixel-art",            name: "像素艺术·复古游戏",     niche: "复古",   oneLiner: "8-bit 像素,游戏感,适合极客文化 / 个人项目展示" },
  { id: "l2-scientific",           baoyuStyleId: "scientific",           name: "科学论文·学术严谨",     niche: "学术",   oneLiner: "学术论文风,数据驱动,适合学术答辩 / 实验汇报" },
  { id: "l2-sketch-notes",         baoyuStyleId: "sketch-notes",         name: "速写笔记·头脑风暴",     niche: "创意",   oneLiner: "速写笔记感,适合 workshop / 共创 / 头脑风暴" },
  { id: "l2-vector-illustration",  baoyuStyleId: "vector-illustration",  name: "矢量插画·明亮活泼",     niche: "插画",   oneLiner: "扁平矢量,明亮活泼,适合产品介绍 / SaaS 着陆页" },
  { id: "l2-vintage",              baoyuStyleId: "vintage",              name: "复古印刷·怀旧感",       niche: "复古",   oneLiner: "复古印刷质感,适合文化品牌 / 餐饮 / 摄影集" },
  { id: "l2-watercolor",           baoyuStyleId: "watercolor",           name: "水彩晕染·治愈风",       niche: "治愈",   oneLiner: "水彩晕染,柔和治愈,适合生活方式 / 健康 / 个人复盘" },
];

// ─────────────────────── 工具:gh api 抓文件 ───────────────────────

function fetchGhFile(owner: string, repo: string, p: string): string {
  const out = execFileSync(
    "gh",
    ["api", `repos/${owner}/${repo}/contents/${p}`, "--jq", ".content"],
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 },
  );
  return Buffer.from(out.trim(), "base64").toString("utf-8");
}

function fetchGhBinary(owner: string, repo: string, p: string): Buffer {
  const out = execFileSync(
    "gh",
    ["api", `repos/${owner}/${repo}/contents/${p}`, "--jq", ".content"],
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 },
  );
  return Buffer.from(out.trim(), "base64");
}

// ─────────────────────── L2 import ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importL2(sql: any) {
  console.log("\n═══ L2 AI 图模板(baoyu-slide-deck 17 风格)═══\n");

  // 截图存到 public/templates/
  const previewDir = path.resolve(process.cwd(), "public/templates");
  mkdirSync(previewDir, { recursive: true });

  for (const t of L2_TEMPLATES) {
    process.stdout.write(`  ${t.id}  `);
    try {
      // 1. 抓 baoyu 风格 spec(.md 完整 prompt)
      const spec = fetchGhFile(
        "JimLiu",
        "baoyu-skills",
        `skills/baoyu-slide-deck/references/styles/${t.baoyuStyleId}.md`,
      );
      // 2. 抓截图 .webp(如果有)
      let previewUrl: string | null = null;
      try {
        const img = fetchGhBinary(
          "JimLiu",
          "baoyu-skills",
          `screenshots/slide-deck-styles/${t.baoyuStyleId}.webp`,
        );
        const localPath = path.join(previewDir, `${t.id}.webp`);
        writeFileSync(localPath, img);
        previewUrl = `/templates/${t.id}.webp`;
      } catch {
        // 个别风格无截图(如 hand-drawn-edu),用占位
      }
      // 3. INSERT/UPDATE templates(custom_prompt_addon 存完整 .md)
      await sql`
        INSERT INTO templates (
          id, owner_user_id, mode, name, topic_tag, style_id, preview_url,
          custom_prompt_addon, baoyu_style_id, template_path, source_repo,
          one_liner, headline, thumb_class,
          locked_ratio, locked_generation_mode,
          is_premium, created_at, updated_at
        ) VALUES (
          ${t.id}, NULL, 'slides', ${t.name}, ${t.niche},
          'baoyu', ${previewUrl},
          ${spec}, ${t.baoyuStyleId}, 'l2_image',
          'JimLiu/baoyu-skills',
          ${t.oneLiner}, ${t.name},
          'as-theme-business',
          '16:9', 'one-by-one',
          FALSE, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, topic_tag = EXCLUDED.topic_tag,
          preview_url = EXCLUDED.preview_url,
          custom_prompt_addon = EXCLUDED.custom_prompt_addon,
          baoyu_style_id = EXCLUDED.baoyu_style_id,
          template_path = EXCLUDED.template_path,
          source_repo = EXCLUDED.source_repo,
          one_liner = EXCLUDED.one_liner,
          updated_at = NOW()
      `;
      console.log(`✓  (preview: ${previewUrl ? "yes" : "no"})`);
    } catch (err) {
      console.log(`✗  ${(err as Error).message?.slice(0, 80)}`);
    }
  }
}

// ─────────────────────── L2 增补 11 个(AIPPT 6 + huashu 5)───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importL2Extra(sql: any) {
  console.log("\n═══ L2 增补模板(AIPPT 6 + huashu 5 = 11 个)═══\n");
  for (const t of EXTRA_L2_TEMPLATES) {
    process.stdout.write(`  ${t.id}  `);
    try {
      await sql`
        INSERT INTO templates (
          id, owner_user_id, mode, name, topic_tag, style_id, preview_url,
          custom_prompt_addon, baoyu_style_id, template_path, source_repo,
          one_liner, headline, thumb_class,
          locked_ratio, locked_generation_mode,
          is_premium, created_at, updated_at
        ) VALUES (
          ${t.id}, NULL, 'slides', ${t.name}, ${t.niche},
          'baoyu', ${t.previewLocal},
          ${t.spec}, ${t.baoyuStyleId}, 'l2_image',
          'AIPPTskill+huashu-design (curated)',
          ${t.oneLiner}, ${t.name},
          'as-theme-business',
          '16:9', 'one-by-one',
          FALSE, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, topic_tag = EXCLUDED.topic_tag,
          custom_prompt_addon = EXCLUDED.custom_prompt_addon,
          baoyu_style_id = EXCLUDED.baoyu_style_id,
          template_path = EXCLUDED.template_path,
          source_repo = EXCLUDED.source_repo,
          one_liner = EXCLUDED.one_liner,
          updated_at = NOW()
      `;
      console.log(`✓  (${(t.spec.length / 1024).toFixed(1)}KB spec, no preview)`);
    } catch (err) {
      console.log(`✗  ${(err as Error).message?.slice(0, 80)}`);
    }
  }
}

// ─────────────────────── L1 import ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importL1(sql: any) {
  console.log("\n═══ L1 HTML 模板(frontend-slides 8 个)═══\n");

  const localBase = path.resolve(process.cwd(), "src/lib/slides/templates");

  for (const t of L1_TEMPLATES) {
    process.stdout.write(`  ${t.id}  `);
    try {
      let html: string;
      let sourceRepo: string;
      let styleId: string;

      if (t.kind === "remote") {
        html = fetchGhFile(t.source.owner, t.source.repo, t.source.htmlPath);
        sourceRepo = `${t.source.owner}/${t.source.repo}`;
        styleId = t.guizangThemeKey ?? "guizang";
      } else {
        const fp = path.join(localBase, t.localPath);
        if (!existsSync(fp)) throw new Error(`本地文件不存在: ${fp}`);
        html = readFileSync(fp, "utf-8");
        sourceRepo = "zarazhangrui/frontend-slides (MIT)";
        // frontend-slides 的 styleId 取文件名(去后缀)
        styleId = path.basename(t.localPath, ".html");
      }

      const thumbClass = t.thumbClass ?? "as-theme-culture";

      await sql`
        INSERT INTO templates (
          id, owner_user_id, mode, name, topic_tag, style_id, preview_url,
          template_html, template_path, source_repo,
          one_liner, headline, thumb_class,
          locked_ratio, locked_generation_mode,
          is_premium, created_at, updated_at
        ) VALUES (
          ${t.id}, NULL, 'slides', ${t.name}, ${t.niche},
          ${styleId}, NULL,
          ${html}, 'l1_html',
          ${sourceRepo},
          ${t.oneLiner}, ${t.name},
          ${thumbClass},
          '16:9', 'batch',
          FALSE, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, topic_tag = EXCLUDED.topic_tag,
          style_id = EXCLUDED.style_id,
          template_html = EXCLUDED.template_html,
          template_path = EXCLUDED.template_path,
          source_repo = EXCLUDED.source_repo,
          one_liner = EXCLUDED.one_liner,
          thumb_class = EXCLUDED.thumb_class,
          updated_at = NOW()
      `;
      console.log(`✓  (${(html.length / 1024).toFixed(1)}KB)`);
    } catch (err) {
      console.log(`✗  ${(err as Error).message?.slice(0, 80)}`);
    }
  }
}

// ─────────────────────── 主流程 ───────────────────────

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  if (!only || only === "l1") await importL1(sql);
  if (!only || only === "l2") await importL2(sql);
  if (!only || only === "l2extra" || only === "l2") await importL2Extra(sql);

  console.log("\n✅ 完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
