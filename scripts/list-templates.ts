// 一次性查询脚本:列出 templates 表内容
import { neon } from "@neondatabase/serverless";

interface Row {
  id: string;
  name: string;
  mode: string;
  style_id: string | null;
  topic_tag: string | null;
  template_path: string | null;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT id, name, mode, style_id, topic_tag, template_path
    FROM templates
    WHERE owner_user_id IS NULL
    ORDER BY mode, id
  `) as unknown as Row[];

  const byMode: Record<string, Row[]> = {};
  for (const r of rows) {
    (byMode[r.mode] ||= []).push(r);
  }
  for (const [mode, list] of Object.entries(byMode)) {
    console.log(`\n[${mode}] ${list.length} 个:`);
    for (const r of list) {
      console.log(
        `  ${r.id.padEnd(28)} | ${(r.style_id || "(none)").padEnd(20)} | ${(r.topic_tag || "").padEnd(10)} | ${r.template_path || ""} | ${r.name}`,
      );
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
