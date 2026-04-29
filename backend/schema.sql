-- 反馈记录表
CREATE TABLE IF NOT EXISTS analysis_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    rating INTEGER,          -- 1=👍 0=👎
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分析结果表（扩展，用于迭代优化）
CREATE TABLE IF NOT EXISTS analysis_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    text TEXT,
    evaluation TEXT,
    segments TEXT,           -- JSON array
    comedy_type TEXT,
    premise TEXT,
    theme_refined TEXT,
    structures TEXT,
    techniques TEXT,         -- JSON array
    improved_script TEXT,
    script_changes TEXT,      -- JSON array
    mode TEXT DEFAULT 'quick',
    feedback_count INTEGER DEFAULT 0,   -- 收到反馈次数
    last_feedback_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI 调用日志
CREATE TABLE IF NOT EXISTS ai_task_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  task_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  input_length INTEGER,
  output_length INTEGER,
  error_code TEXT,
  error_message TEXT,
  request_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Prompt 版本表
CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    fragment_name TEXT NOT NULL,  -- 改的是哪个片段
    old_content TEXT,
    new_content TEXT,
    reason TEXT,
    test_cases TEXT,         -- JSON array: 验证用的历史case
    old_scores TEXT,          -- JSON array
    new_scores TEXT,          -- JSON array
    improvement REAL,          -- new_avg - old_avg
    deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rolled_back_at DATETIME,
    is_active INTEGER DEFAULT 1
);
