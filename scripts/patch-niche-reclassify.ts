// scripts/patch-niche-reclassify.ts
// PR4:把 74 个模板的 topic_tag(niche)统一收编到 8 个新分类。
//
// 新分类(slides):商务 / 编辑 / 工作室 / 品牌 / 复古 / 教育 / 科技 / 海报
// cards 模块 1 个保留 niche="读书"(独立模块)
//
// 用法:
//   npx tsx --env-file=.env.local scripts/patch-niche-reclassify.ts
//
// 幂等:UPDATE topic_tag,反复跑安全。
//
// 配套改动:TemplateGrid.tsx slideNiches 常量 + NICHE_LABEL_KEY +
// SlidesTemplatePickerModal.tsx + 5 个 messages/<locale>.json 新增 i18n key。

import { neon } from "@neondatabase/serverless";

// ─────────────── 8 大新分类 + 模板归属 ───────────────

const NICHE_MAP: Record<string, string[]> = {
  // 商务汇报(8 个)— 路演 / 季度复盘 / 投资人 / 客户提案
  商务: [
    "slides-modern-pro-business-3acts",
    "slides-modern-pro-pitch-deck",
    "slides-modern-pro-quarterly-review",
    "l1-fs-bold-signal",
    "l2-corporate",
    "ext-blue-professional",
    "ext-signal",
    "ext-monochrome",
  ],
  // 杂志编辑(11 个)— editorial / 长文 / 白皮书
  编辑: [
    "l1-fs-vintage-editorial",
    "l1-guizang-monocle",
    "l2-bold-editorial",
    "l2-editorial-infographic",
    "ext-soft-editorial",
    "ext-editorial-tri-tone",
    "ext-broadside",
    "ext-cartesian",
    "ext-vellum",
    "ext-cobalt-grid",
    "ext-stencil-tablet",
  ],
  // 创意工作室(12 个)— 设计工作室 / 包豪斯 / 极简 / 新粗野
  工作室: [
    "l1-fs-creative-voltage",
    "l1-fs-electric-studio",
    "l2-bauhaus",
    "l2-minimal",
    "l2-neo-brutalism",
    "l2-sagmeister",
    "ext-studio",
    "ext-mat",
    "ext-creative-mode",
    "ext-raw-grid",
    "ext-neo-grid-bold",
    "ext-block-frame",
  ],
  // 品牌生活(12 个)— DTC / 时尚 / 治愈 / 美容
  品牌: [
    "l1-fs-dark-botanical",
    "l1-fs-pastel-geometry",
    "l1-fs-split-pastel",
    "l2-dark-atmospheric",
    "l2-watercolor",
    "l2-vector-illustration",
    "ext-capsule",
    "ext-coral",
    "ext-grove",
    "ext-long-table",
    "ext-pink-script",
    "ext-playful",
  ],
  // 复古怀旧(9 个)— 像素 / Riso / 浮世绘 / 敦煌 / Win95
  复古: [
    "l2-pixel-art",
    "l2-risograph",
    "l2-ukiyo-e",
    "l2-vintage",
    "l2-dunhuang",
    "ext-8-bit-orbit",
    "ext-retro-windows",
    "ext-retro-zine",
    "ext-sakura-chroma",
  ],
  // 教育课件(10 个)— 黑板 / 手绘 / 速写 / 学术 / 便利贴
  教育: [
    "l1-fs-notebook-tabs",
    "l1-guizang-kraft",
    "l2-chalkboard",
    "l2-hand-drawn-edu",
    "l2-sketch-notes",
    "l2-snoopy",
    "l2-scientific",
    "ext-daisy-days",
    "ext-scatterbrain",
    "ext-pin-and-paper",
  ],
  // 科技未来(8 个)— AI / 算法 / 蓝图 / FUI / Notion
  科技: [
    "l2-active-theory",
    "l2-ash-thorp",
    "l2-blueprint",
    "l2-field-io",
    "l2-fantasy-animation",
    "l2-intuition-machine",
    "l2-notion",
    "l2-territory-fui",
  ],
  // 海报宣言(3 个)— 双年展 / 文化评论
  海报: [
    "ext-bold-poster",
    "ext-biennale-yellow",
    "ext-peoples-platform",
  ],

  // cards 模块独立(1 个,niche 保留"读书"以匹配 image niche 风格)
  读书: ["cards-xhs-fresh-book-quote"],
};

// ─────────────── 主流程 ───────────────

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  // 校验:8 + 1 = 9 分类,模板 ID 总数 73 + 1 = 74 不重不漏
  const allIds = new Set<string>();
  for (const [niche, ids] of Object.entries(NICHE_MAP)) {
    for (const id of ids) {
      if (allIds.has(id)) {
        console.error(`❌ 重复 ID:${id}(niche=${niche})`);
        process.exit(1);
      }
      allIds.add(id);
    }
  }
  if (allIds.size !== 74) {
    console.error(`❌ ID 总数错:${allIds.size},应该 74`);
    process.exit(1);
  }

  // DB 现有所有模板 ID,看是否有遗漏 / 多余
  const dbRows = (await sql`
    SELECT id, topic_tag FROM templates WHERE owner_user_id IS NULL
  `) as Array<{ id: string; topic_tag: string | null }>;
  const dbIds = new Set(dbRows.map((r) => r.id));

  const missingInPlan = [...dbIds].filter((id) => !allIds.has(id));
  const planButNotInDb = [...allIds].filter((id) => !dbIds.has(id));
  if (missingInPlan.length > 0) {
    console.warn(`⚠ DB 有但分类未覆盖:${missingInPlan.join(", ")}`);
  }
  if (planButNotInDb.length > 0) {
    console.warn(`⚠ 分类列了但 DB 没有:${planButNotInDb.join(", ")}`);
  }

  // 跑 UPDATE
  let updated = 0;
  let skipped = 0;
  for (const [niche, ids] of Object.entries(NICHE_MAP)) {
    for (const id of ids) {
      const result = (await sql`
        UPDATE templates SET
          topic_tag  = ${niche},
          updated_at = NOW()
        WHERE id = ${id} AND owner_user_id IS NULL
        RETURNING id
      `) as Array<{ id: string }>;
      if (result.length > 0) {
        updated += 1;
      } else {
        skipped += 1;
        console.warn(`  ⚠ 跳过(模板不存在):${id}`);
      }
    }
  }

  console.log(`\n✅ 完成 — 更新 ${updated} / 跳过 ${skipped} / 计划 ${allIds.size}`);
  console.log(`\n新 niche 分布:`);
  for (const [niche, ids] of Object.entries(NICHE_MAP)) {
    console.log(`  ${niche.padEnd(6)} → ${ids.length} 个`);
  }
}

main().catch((err) => {
  console.error("❌ patch 失败:", err);
  process.exit(1);
});
