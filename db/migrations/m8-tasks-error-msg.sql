-- M8 T2-51:任务错误信息持久化 + 前端友好显示
-- 跑法:DATABASE_URL=... npx tsx scripts/migrate.ts
--
-- 背景:NSFW 拦截 / API 异常 / polling timeout 失败时,后端有详细错误信息(中文友好提示),
-- 但 tasks 表没字段存,前端只能显示通用「任务失败,请重试或联系支持」 — 用户无从知道为什么。
-- 加 error_message TEXT NULLABLE,失败时 inngest handler 写入,GET/SSE 一并返回前端展示。

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS error_message TEXT;
