// 调试:看 templates 表当前 SQL ORDER BY 的实际结果
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT
      id, name, preview_url, mode, uses_count,
      CASE WHEN preview_url IS NOT NULL THEN '有截图' ELSE '占位' END AS label
    FROM templates
    WHERE owner_user_id IS NULL AND mode = 'slides'
    ORDER BY (preview_url IS NULL) ASC, uses_count DESC, created_at DESC
  `) as unknown as Array<{ id: string; name: string; preview_url: string | null; mode: string; uses_count: number; label: string }>;

  console.log("\n═══ slides 模板按 (preview_url IS NULL) ASC 排序结果 ═══\n");
  rows.forEach((r, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. [${r.label}] ${r.id.padEnd(28)} ${r.name}`);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
