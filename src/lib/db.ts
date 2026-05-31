// Neon Postgres 客户端单例
//
// 用法：
//   import { sql } from '@/lib/db';
//   const rows = await sql`SELECT id FROM users WHERE id = ${userId}`;
//
// 模板字符串自动参数化，杜绝 SQL 注入。
// 详见 @neondatabase/serverless 文档。

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('db: 生产环境缺少 DATABASE_URL');
}

// 开发环境允许延迟到首次查询时再报错（保留 dev server 启动顺畅）。
export const sql: NeonQueryFunction<false, false> = neon(databaseUrl ?? '');
