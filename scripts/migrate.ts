// scripts/migrate.ts — 跑 db/schema.sql + db/migrations/*.sql 到 Neon
//
// 使用：
//   DATABASE_URL=postgres://... npx tsx scripts/migrate.ts
//   或 npx tsx --env-file=.env.local scripts/migrate.ts
//
// 注意：
//   - schema.sql + migrations/*.sql 必须全部用 IF NOT EXISTS / 幂等，反复跑不报错
//   - Neon HTTP 驱动一次只能一条语句，因此本脚本按 `;` 切分（粗略，注释里的分号会被忽略）
//   - migrations/*.sql 按文件名字典序应用(m1- m2- m3- m4- 等),保证顺序

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

function loadFile(file: string): string {
  return readFileSync(file, 'utf-8');
}

function splitStatements(raw: string): string[] {
  const stripped = raw
    .split('\n')
    .map((l) => (l.trimStart().startsWith('--') ? '' : l))
    .join('\n');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('错误：缺少 DATABASE_URL 环境变量');
    process.exit(1);
  }

  const cwd = process.cwd();
  const schemaPath = path.resolve(cwd, 'db/schema.sql');
  const migrationsDir = path.resolve(cwd, 'db/migrations');

  // 收集要跑的文件:schema.sql 先,然后 migrations/ 字典序
  const files: string[] = [schemaPath];
  if (existsSync(migrationsDir)) {
    const ms = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => path.resolve(migrationsDir, f));
    files.push(...ms);
  }

  const sql = neon(url);
  let totalStmts = 0;
  let totalOk = 0;

  for (const f of files) {
    const rel = path.relative(cwd, f);
    const stmts = splitStatements(loadFile(f));
    console.log(`\n> ${rel}: ${stmts.length} 条语句`);
    totalStmts += stmts.length;
    for (const [i, stmt] of stmts.entries()) {
      const preview = stmt.split('\n')[0].slice(0, 80);
      try {
        await sql.query(stmt);
        totalOk += 1;
        console.log(`  [${i + 1}/${stmts.length}] ✓ ${preview}…`);
      } catch (err) {
        console.error(`  [${i + 1}/${stmts.length}] ✗ ${preview}…`);
        console.error('   →', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    }
  }

  console.log(`\n✅ 完成:${totalOk}/${totalStmts} 条语句通过(${files.length} 个文件)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
