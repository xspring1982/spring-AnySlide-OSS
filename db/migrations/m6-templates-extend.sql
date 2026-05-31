-- M6 ============================================================
-- templates 表扩展:补 promptSeed / lockedRatio / lockedGenerationMode 等字段
-- 让模板真正成为"完整 prompt 骨架"载体(SPEC §2.9 + Phase2 T2-30 核心价值)
-- ============================================================

-- locked_ratio:模板锁定的比例,用户点模板自动应用
ALTER TABLE templates ADD COLUMN IF NOT EXISTS locked_ratio TEXT;

-- locked_generation_mode:slides 专属 — batch=L1(HTML) / one-by-one=L2(AI 图)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS locked_generation_mode TEXT;

-- headline / subhead:无封面图时缩略图占位显示用
ALTER TABLE templates ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS subhead TEXT;

-- uses_count:用户使用次数(展示 + 排序 + 热度)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS uses_count INT NOT NULL DEFAULT 0;

-- thumb_class:无封面图时占位 CSS class(对应 globals.css 已有的 as-theme-business 等)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS thumb_class TEXT;

-- one_liner:一句话简介,模板预览弹窗 + sidebar list 用
ALTER TABLE templates ADD COLUMN IF NOT EXISTS one_liner TEXT;

-- 索引:按 mode + uses_count 排序(热门优先展示)
CREATE INDEX IF NOT EXISTS idx_templates_mode_uses
  ON templates (mode, uses_count DESC)
  WHERE owner_user_id IS NULL;
