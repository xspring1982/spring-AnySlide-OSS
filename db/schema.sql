-- AnySlide DB schema v2
-- 对应 SPEC §2.9.1（Cards / 共享）+ §6.1 上线前 checklist 1.1
-- 6 张表：users / tasks / task_versions / task_files / templates / credit_transactions
-- Postgres 14+（Neon Serverless）
--
-- 注意：v2 全部使用 TEXT 主键（与 Clerk user_id 直接对齐 / 任务用 nanoid）。
-- 已废弃 v1 的 UUID + gen_random_uuid()，因此不再需要 pgcrypto 扩展。

-- ============================================================
-- 1. users（共享，Clerk-keyed）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,                                 -- Clerk user_id
  email             TEXT UNIQUE NOT NULL,
  credit_balance    INT NOT NULL DEFAULT 60,                          -- 当前积分余额（注册赠送 60）
  credit_reset_at   TIMESTAMPTZ,                                      -- Free 用户每日重置时间
  plan              TEXT NOT NULL DEFAULT 'free',                     -- 'free' | 'plus' | 'pro'
  text_model_pref   TEXT NOT NULL DEFAULT 'mid',                      -- 'high' | 'mid' | 'low'
  image_model_pref  TEXT NOT NULL DEFAULT 'high',                     -- 'high' | 'mid' | 'low'
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. templates（共享，跨 cards / slides / image）
-- 先于 tasks 建表：tasks.template_id 引用此表
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
  id                       TEXT PRIMARY KEY,
  owner_user_id            TEXT REFERENCES users(id) ON DELETE CASCADE, -- 系统模板为 NULL
  mode                     TEXT NOT NULL,                              -- 'cards' | 'slides' | 'image'
  name                     TEXT NOT NULL,
  topic_tag                TEXT,                                       -- 副标签（"读书 / 财经 / 美妆"，搜索用）
  style_id                 TEXT NOT NULL,                              -- 锁定的风格 ID
  preview_url              TEXT,                                       -- R2 预览图 URL（admin 一次性脚本生成）

  -- 预填的澄清答案（cards / slides 用）
  preset_audience          TEXT,
  preset_focus             TEXT,
  preset_tone              TEXT,
  preset_outline_strategy  TEXT,                                       -- slides 用

  recommended_count        INT,                                        -- 推荐张数
  reference_images         JSONB,                                      -- [{url, role}] 模板自带 anchor 参考图
  custom_prompt_addon      TEXT,                                       -- 模板专属附加 prompt
  is_premium               BOOLEAN NOT NULL DEFAULT FALSE,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_mode_style
  ON templates (mode, style_id)
  WHERE owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_templates_owner
  ON templates (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- ============================================================
-- 3. tasks（核心，三模块共用）
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                      TEXT PRIMARY KEY,                           -- nanoid()
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode                    TEXT NOT NULL,                              -- 'cards' | 'slides' | 'image'
  title                   TEXT NOT NULL,
  slug                    TEXT NOT NULL,                              -- URL 友好标识（用于文件命名）
  status                  TEXT NOT NULL DEFAULT 'created',
    -- 'created' | 'analyzing' | 'clarifying' | 'outlining' | 'confirming'
    -- | 'generating' | 'done' | 'failed' | 'cancelled'
  agent_phase             TEXT,                                       -- 'analyze' | 'clarify' | 'outline' | 'confirm' | 'cover' | 'batch' | 'done'

  -- 输入参数
  source_text             TEXT,
  source_file_url         TEXT,
  style_id                TEXT NOT NULL,
  ratio                   TEXT NOT NULL,                              -- '3:4' | '4:5' | '1:1' | '9:16' | '16:9'
  generation_mode         TEXT NOT NULL DEFAULT 'batch',              -- 'batch' | 'one-by-one'
  template_id             TEXT REFERENCES templates(id) ON DELETE SET NULL,
  preserve_content        BOOLEAN NOT NULL DEFAULT FALSE,             -- slides 保真模式:只分页不改写原文

  -- agent 中间产物
  analyze_result          JSONB,
  clarify_answers         JSONB,
  research_data           JSONB,

  -- 元数据
  current_version_no      INT NOT NULL DEFAULT 1,
  text_model_used         TEXT,
  image_model_used        TEXT,
  total_credits_charged   INT NOT NULL DEFAULT 0,
  total_credits_refunded  INT NOT NULL DEFAULT 0,

  -- M8 T2-51:失败原因,前端友好显示。NULL 表示无错误
  error_message           TEXT,

  deleted_at              TIMESTAMPTZ,                                -- 软删（30 天后 cron 物理删）

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_created
  ON tasks (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_status_active
  ON tasks (status, updated_at)
  WHERE status NOT IN ('done', 'failed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_tasks_deleted
  ON tasks (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ============================================================
-- 4. task_versions（大纲版本管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS task_versions (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_no      INT NOT NULL,                                       -- 1-based
  outline         JSONB NOT NULL,                                     -- 完整 outline（含每张卡片定义）
  canvas_layout   JSONB,                                              -- 画布上各卡片的位置 / 缩放
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (task_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_task_versions_task
  ON task_versions (task_id, version_no DESC);

-- ============================================================
-- 5. task_files（每张图片 / prompt / source / ref / export）
-- ============================================================
CREATE TABLE IF NOT EXISTS task_files (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_id      TEXT REFERENCES task_versions(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,                                      -- 'source' | 'prompt' | 'image' | 'ref' | 'export'
  page_no         INT,                                                -- 仅 type=image/prompt（1-based）
  page_version    INT,                                                -- 仅 type=image/prompt（该页第几版）
  role            TEXT,                                               -- 'cover' | 'content' | 'closing'
  filename        TEXT NOT NULL,
  storage_url     TEXT NOT NULL,                                      -- 本地路径或 R2 URL
  size_bytes      BIGINT,
  mime_type       TEXT,
  expires_at      TIMESTAMPTZ,                                        -- Free 用户图片 7 天后过期
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_task
  ON task_files (task_id);

CREATE INDEX IF NOT EXISTS idx_files_page
  ON task_files (task_id, page_no, page_version)
  WHERE type IN ('image', 'prompt');

CREATE INDEX IF NOT EXISTS idx_files_expires
  ON task_files (expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 6. credit_transactions（积分流水，详见 SPEC §5.4）
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id       TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  delta         INT NOT NULL,                                         -- 正 = 入账 / 负 = 扣减
  reason        TEXT NOT NULL,
    -- 'generate' | 'refund_failed' | 'refund_cancelled'
    -- | 'topup' | 'subscribe' | 'daily_reset' | 'signup_bonus'
  model_used    TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_user_created
  ON credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credits_task
  ON credit_transactions (task_id)
  WHERE task_id IS NOT NULL;
