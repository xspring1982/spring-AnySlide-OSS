-- M9 ============================================================
-- 多语言模板基建 — Phase2 多语言阶段 1
--
-- 背景:
--   line 上 routing.ts 声明了 5 种 locale(en / zh / zh-TW / ja / ko),
--   但 templates 表所有展示字段都是单语言(中文)。
--   切到 en/ja/ko 时:模板列表名/简介都是中文,promptSeed 也是中文,
--   AI 生成出来的 deck 还是中文 → 真正可用语言只有 1 个。
--
-- 改造原则:
--   1. 不动旧字段(name / one_liner / custom_prompt_addon / headline / subhead),
--      作为 fallback 兜底,保证旧代码 / 旧 task 不受影响
--   2. 新加 *_i18n JSONB 字段,值为 {"en":"...","zh":"...","zh-TW":"...","ja":"...","ko":"..."}
--   3. seed 脚本和 API 优先读 *_i18n[locale],缺则 fallback 到 *_i18n.en,
--      再缺 fallback 到旧字段
--   4. tasks 表加 locale,记录 task 创建时用户的 UI 语言,生成时按这个语言调 LLM
-- ============================================================

-- templates 表多语言字段
ALTER TABLE templates ADD COLUMN IF NOT EXISTS name_i18n JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS one_liner_i18n JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS prompt_seed_i18n JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS headline_i18n JSONB;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS subhead_i18n JSONB;

-- tasks 表加 locale
-- 已有 task 默认 'zh'(创建本字段前线上用户大多是中文)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'zh';

-- 校验 locale 合法值(对应 src/i18n/routing.ts 5 语言)
-- Postgres 不支持 ADD CONSTRAINT IF NOT EXISTS,用 DROP+ADD 两步等效幂等。
-- (DO $$ 块同样可行,但 migrate.ts 简易切分器按 ; 拆语句,会切碎 $$ 内部)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_locale_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_locale_check
  CHECK (locale IN ('en', 'zh', 'zh-TW', 'ja', 'ko'));
