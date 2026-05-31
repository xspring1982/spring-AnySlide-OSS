// 一次性:删除 2 个 guizang L1 模板(JS 填充骨架,无法标注大纲,整体下线)。
// tasks.template_id 外键为 ON DELETE SET NULL,且 0 个任务用过 → 删除安全。
// 用法:npx tsx --env-file=.env.local scripts/delete-guizang-templates.ts [--confirm]
import { neon } from "@neondatabase/serverless";

const IDS = ["l1-guizang-monocle", "l1-guizang-kraft"];
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const before = (await sql`SELECT id, name FROM templates WHERE id = ANY(${IDS})`) as Array<{ id: string; name: string }>;
  console.log(`待删:${before.length} 个 — ${before.map((t) => `${t.id}(${t.name})`).join(", ") || "(无)"}`);
  if (before.length === 0) {
    console.log("已不存在,无需删除。");
    return;
  }
  if (!CONFIRM) {
    console.log("DRY RUN — 加 --confirm 才删除");
    return;
  }
  await sql`DELETE FROM templates WHERE id = ANY(${IDS})`;
  const after = (await sql`SELECT count(*)::int n FROM templates WHERE id = ANY(${IDS})`) as Array<{ n: number }>;
  const totalL1 = (await sql`SELECT count(*)::int n FROM templates WHERE template_path='l1_html' AND owner_user_id IS NULL`) as Array<{ n: number }>;
  console.log(`✅ 已删除。剩余匹配 ${after[0].n}(应 0);现 l1_html 模板 ${totalL1[0].n} 个。`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
