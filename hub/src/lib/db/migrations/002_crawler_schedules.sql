-- Migration: Move cron from target-level to crawler-level
-- 将定时任务配置从 target 级别提升到爬虫级别

-- 1. 创建爬虫调度配置表
CREATE TABLE IF NOT EXISTS crawler_schedules (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL UNIQUE,  -- substack, youtube, sec_edgar 等
    enabled BOOLEAN DEFAULT true,
    cron_expression VARCHAR(100) DEFAULT '0 */6 * * *',
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),  -- success, failed
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 从 crawl_targets 移除 cron_expression 字段
-- 注意：这是不可逆操作，数据会丢失
ALTER TABLE crawl_targets DROP COLUMN IF EXISTS cron_expression;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_crawler_schedules_source ON crawler_schedules(source_type);
CREATE INDEX IF NOT EXISTS idx_crawler_schedules_enabled ON crawler_schedules(enabled);

-- 4. 初始化默认调度配置（基于现有的 source_types）
-- 从环境变量或默认值获取支持的 source types
INSERT INTO crawler_schedules (source_type, enabled, cron_expression)
VALUES
    ('substack', true, '0 */6 * * *'),
    ('youtube', true, '0 */6 * * *'),
    ('sec_edgar', true, '0 */6 * * *'),
    ('reddit', true, '0 */6 * * *'),
    ('wechat', true, '0 */6 * * *'),
    ('cninfo', true, '0 */6 * * *')
ON CONFLICT (source_type) DO NOTHING;

-- 5. 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_crawler_schedules_updated_at ON crawler_schedules;
CREATE TRIGGER update_crawler_schedules_updated_at
    BEFORE UPDATE ON crawler_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
