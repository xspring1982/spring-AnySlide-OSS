-- m10:slides 保真模式 — 任务级标记,true 表示"只分页保留原文、不让 LLM 改写内容"。
-- 幂等:反复跑不报错。
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS preserve_content BOOLEAN NOT NULL DEFAULT FALSE;
