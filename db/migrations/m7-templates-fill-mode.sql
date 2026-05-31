-- M7 ============================================================
-- 模板矩阵化 — Phase2 T2-30/T2-33 战略落地
--
-- L1 HTML 模板:存完整 HTML(带占位)+ LLM 在 generate 时填充
-- L2 AI 图模板:存 baoyu 风格 id,生成时锁定该风格
--
-- 不再用"风格 × 版式 × 内容"的拼装管线
-- ============================================================

-- L1 用:完整 HTML 模板源码(带 demo 内容,LLM 改写为用户内容)
-- 单个 ≤ 100KB,Postgres TEXT 充裕
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS template_html TEXT;

-- L1 用:模板的 slide 结构概要(LLM 改写时知道有几页 / 每页类型)
-- 例 [{role:'cover',title:'...'},{role:'agenda',items:[]},...]
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS template_outline JSONB;

-- L2 用:锁定的 baoyu 风格 id(blueprint / corporate / vintage 等 17 个)
-- 生成时把对应风格的 .md spec 注入 image prompt
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS baoyu_style_id TEXT;

-- 模板技术路径:'l1_html' | 'l2_image' | 'cards_compose'(图文卡片用)
-- 跟 mode 字段不同 — mode 是产品概念(slides/cards/image),path 是技术路径
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS template_path TEXT;

-- 模板来源标注(便于追溯)
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS source_repo TEXT;
