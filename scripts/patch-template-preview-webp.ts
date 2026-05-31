// scripts/patch-template-preview-webp.ts
// PR5:把 DB 中所有 ext-* 模板的 preview_url 后缀从 .png 改为 .webp。
//
// 配套 scripts/optimize-template-screenshots.ts 一起用 —— 转完 webp 后跑这个
// 同步 DB,前端立即用上新格式。
//
// 用法:
//   npx tsx --env-file=.env.local scripts/patch-template-preview-webp.ts
//
// 幂等:UPDATE WHERE 后缀 = .png,反复跑只改一次。

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  const before = (await sql`
    SELECT COUNT(*) as count FROM templates
    WHERE owner_user_id IS NULL
      AND preview_url LIKE '/templates/external/%.png'
  `) as Array<{ count: number }>;

  console.log(`待更新:${before[0].count} 个模板的 preview_url 后缀`);

  const result = (await sql`
    UPDATE templates
    SET preview_url = REPLACE(preview_url, '.png', '.webp'),
        updated_at = NOW()
    WHERE owner_user_id IS NULL
      AND preview_url LIKE '/templates/external/%.png'
    RETURNING id, preview_url
  `) as Array<{ id: string; preview_url: string }>;

  for (const r of result) {
    console.log(`  ↻ ${r.id} → ${r.preview_url}`);
  }
  console.log(`\n✅ 完成 — 更新 ${result.length} 个模板`);
}

main().catch((err) => {
  console.error("❌ patch 失败:", err);
  process.exit(1);
});
