import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  const r = (await sql`SELECT id, mode, status, title FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 12`) as Array<{
    id: string;
    mode: string;
    status: string;
    title: string;
  }>;
  for (const t of r)
    console.log(
      t.id.padEnd(14),
      t.mode.padEnd(7),
      t.status.padEnd(12),
      (t.title ?? "").slice(0, 30),
    );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
