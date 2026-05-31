// 一次性查询脚本:列出 slides 模板按 uses_count 排序的前 25 名
// 给 Phase 2 续选模板做参考(不入仓库的话用完删,但放 scripts/ 也无害)

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT id, name, mode, style_id, topic_tag, template_path, uses_count, one_liner
    FROM templates
    WHERE owner_user_id IS NULL AND mode = 'slides'
    ORDER BY uses_count DESC NULLS LAST, id
    LIMIT 25
  `;
  console.log(
    "ID".padEnd(28),
    "uses".padEnd(5),
    "style".padEnd(20),
    "topic".padEnd(12),
    "path"
  );
  for (const r of rows as unknown as {
    id: string;
    uses_count: number | null;
    style_id: string | null;
    topic_tag: string | null;
    template_path: string | null;
  }[]) {
    console.log(
      String(r.id).padEnd(28),
      String(r.uses_count ?? 0).padEnd(5),
      String(r.style_id ?? "(none)").padEnd(20),
      String(r.topic_tag ?? "").padEnd(12),
      r.template_path ?? ""
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
