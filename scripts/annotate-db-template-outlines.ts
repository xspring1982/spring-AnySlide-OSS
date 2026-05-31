// 给 DB 里 HTML 已导入、但 template_outline 仍空的 L1 模板补大纲标注。
// 复用 annotate-template-outlines.ts 的 annotate() 启发式,但 HTML 从 templates.template_html 读
// (适用于 fs/guizang 等不在 external/ 目录的导入模板)。
//
// 用法:
//   预览(只读):  npx tsx --env-file=.env.local scripts/annotate-db-template-outlines.ts
//   写库:        npx tsx --env-file=.env.local scripts/annotate-db-template-outlines.ts --confirm
import { neon } from "@neondatabase/serverless";
import { annotate } from "./annotate-template-outlines";

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ 缺 DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);

  const rows = (await sql`
    SELECT id, name, template_html
    FROM templates
    WHERE template_path = 'l1_html'
      AND owner_user_id IS NULL
      AND (template_outline IS NULL OR jsonb_array_length(template_outline) = 0)
    ORDER BY name
  `) as Array<{ id: string; name: string; template_html: string | null }>;

  console.log(`未标注 L1 模板:${rows.length} 个${CONFIRM ? "(将写库)" : "(DRY RUN)"}\n`);

  let ok = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!r.template_html) {
      console.warn(`  ⚠ ${r.id} (${r.name}): 无 template_html,跳过`);
      skipped += 1;
      continue;
    }
    const outline = annotate(r.template_html);
    if (outline.length === 0) {
      console.warn(`  ⚠ ${r.id} (${r.name}): 解析出 0 sections,跳过`);
      skipped += 1;
      continue;
    }
    const roles: Record<string, number> = {};
    for (const s of outline) roles[s.role] = (roles[s.role] ?? 0) + 1;
    const rolesStr = Object.entries(roles)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(`  ${r.id.padEnd(26)} ${outline.length} 页 — ${rolesStr}`);

    if (CONFIRM) {
      await sql`
        UPDATE templates
        SET template_outline = ${JSON.stringify(outline)}::jsonb, updated_at = NOW()
        WHERE id = ${r.id} AND owner_user_id IS NULL
      `;
    }
    ok += 1;
  }

  console.log(
    `\n${CONFIRM ? "✅ 已写入" : "DRY RUN 完成"} — 可标注 ${ok} / 跳过 ${skipped} / 共 ${rows.length}`,
  );
  if (!CONFIRM) console.log("（确认无误后加 --confirm 写库）");
}

main().catch((e) => {
  console.error("❌ 失败:", e);
  process.exit(1);
});
