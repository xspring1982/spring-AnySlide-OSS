-- M5 ============================================================
-- Project 模式:cards / image / slides 三模块统一进入 project 容器
--   - cards/image:1 project 多 batch(task),共享画布累积图
--   - slides:1 project = 1 task(逻辑上一个 deck),无累积
-- ============================================================

-- 1. 新表 projects ----------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,                          -- nanoid
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,                             -- 'cards' | 'image' | 'slides'
  title           TEXT NOT NULL DEFAULT '未命名项目',
  -- 画布全局状态:zoom + pan + 每个 image card (taskId-pageNo) 的位置/尺寸 override
  -- {zoom: 1, pan: {x,y}, positions: {"<taskId>-<pageNo>": {x,y,w,h}}}
  canvas_state    JSONB,
  cover_image_url TEXT,                                      -- 项目列表展示用,首张图自动填
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_updated
  ON projects (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deleted
  ON projects (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 2. tasks 加 project_id ---------------------------------------
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_project
  ON tasks (project_id, created_at)
  WHERE deleted_at IS NULL;

-- 3. 老数据迁移:每个未关联的 task 包一个 1-batch project ------------
--    project.title 用 task.title 截前 40 字
--    project.cover_image_url 暂留空(后续 cover 字段在第一张图上线时回填)
INSERT INTO projects (id, user_id, mode, title, created_at, updated_at)
SELECT
  CONCAT('p_legacy_', t.id),
  t.user_id,
  t.mode,
  COALESCE(NULLIF(t.title, ''), '未命名项目'),
  t.created_at,
  t.updated_at
FROM tasks t
WHERE t.project_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE tasks t
SET project_id = CONCAT('p_legacy_', t.id)
WHERE t.project_id IS NULL;

-- 4. 兼容性:project 列表 cover 自动填 ---------------------------
--    后续应用层在每个 task 第一张图生成时 UPDATE 一次。
--    这里先用现有 task_files 数据回填一次。
WITH first_images AS (
  SELECT DISTINCT ON (t.project_id)
    t.project_id,
    f.storage_url
  FROM tasks t
  JOIN task_files f ON f.task_id = t.id
  WHERE t.project_id IS NOT NULL
    AND f.type = 'image'
    AND f.deleted_at IS NULL
  ORDER BY t.project_id, t.created_at, f.created_at
)
UPDATE projects p
SET cover_image_url = fi.storage_url
FROM first_images fi
WHERE p.id = fi.project_id AND p.cover_image_url IS NULL;
