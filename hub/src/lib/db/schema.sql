-- Hub System Schema
-- 用于监控抓取系统各组件运行状态

-- 抓取目标总表（Hub 统一视图）
CREATE TABLE IF NOT EXISTS crawl_targets (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,  -- wechat, youtube, xiaoyuzhou
    target_name VARCHAR(255) NOT NULL,
    target_identifier VARCHAR(500) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    cron_expression VARCHAR(100) DEFAULT '0 */6 * * *',
    last_crawl_at TIMESTAMPTZ,
    last_crawl_status VARCHAR(50),  -- pending, running, success, failed
    last_error TEXT,
    total_items INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 抓取运行日志
CREATE TABLE IF NOT EXISTS crawl_runs (
    id SERIAL PRIMARY KEY,
    target_id INTEGER REFERENCES crawl_targets(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',  -- running, success, failed
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    items_found INTEGER DEFAULT 0,
    items_new INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER
);

-- 组件健康状态
CREATE TABLE IF NOT EXISTS component_status (
    id SERIAL PRIMARY KEY,
    component_name VARCHAR(100) NOT NULL UNIQUE,  -- wechat_crawler, youtube_crawler, xiaoyuzhou_crawler, transcriber
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',  -- healthy, degraded, down, unknown
    last_heartbeat TIMESTAMPTZ,
    last_error TEXT,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统事件日志
CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,  -- crawl_start, crawl_end, crawl_error, target_enabled, target_disabled
    source VARCHAR(100),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 数据统计快照（定期更新）
CREATE TABLE IF NOT EXISTS data_stats (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    row_count INTEGER DEFAULT 0,
    latest_item_at TIMESTAMPTZ,
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crawl_targets_source ON crawl_targets(source_type);
CREATE INDEX IF NOT EXISTS idx_crawl_targets_enabled ON crawl_targets(enabled);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_target ON crawl_runs(target_id);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_started ON crawl_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_stats_source ON data_stats(source_type, snapshot_at DESC);
