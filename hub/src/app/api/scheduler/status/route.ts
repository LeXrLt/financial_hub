/**
 * 调度器状态 API（按 source_type）
 * 获取爬虫调度和抓取目标的当前状态
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export const dynamic = 'force-dynamic';

interface CrawlerStatus {
  source_type: string;
  enabled: boolean;
  cron_expression: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
}

interface TargetStatus {
  id: number;
  source_type: string;
  target_name: string;
  enabled: boolean;
  last_crawl_at: string | null;
  last_crawl_status: string | null;
  total_items: number;
}

interface RecentRun {
  id: number;
  target_name: string;
  source_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_new: number;
}

export async function GET() {
  try {
    // 获取爬虫调度配置
    const crawlersResult = await query<CrawlerStatus>(
      `SELECT 
        source_type, enabled, cron_expression,
        last_run_at, last_run_status, last_error
       FROM crawler_schedules 
       ORDER BY source_type`
    );

    // 获取所有目标状态
    const targetsResult = await query<TargetStatus>(
      `SELECT 
        id, source_type, target_name, enabled, 
        last_crawl_at, last_crawl_status, total_items
       FROM crawl_targets 
       ORDER BY source_type, target_name`
    );

    // 获取最近运行记录
    const runsResult = await query<RecentRun>(
      `SELECT 
        cr.id, ct.target_name, ct.source_type,
        cr.status, cr.started_at, cr.finished_at, cr.items_new
       FROM crawl_runs cr
       JOIN crawl_targets ct ON cr.target_id = ct.id
       ORDER BY cr.started_at DESC
       LIMIT 10`
    );

    // 统计信息 - targets
    const targetStatsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
        COUNT(*) FILTER (WHERE enabled = false) as disabled_count
      FROM crawl_targets
    `);

    // 统计信息 - crawlers
    const crawlerStatsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
        COUNT(*) FILTER (WHERE enabled = false) as disabled_count,
        COUNT(*) FILTER (WHERE last_run_status = 'success') as success_count,
        COUNT(*) FILTER (WHERE last_run_status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE last_run_status = 'running') as running_count
      FROM crawler_schedules
    `);

    const targetStats = targetStatsResult.rows[0];
    const crawlerStats = crawlerStatsResult.rows[0];

    // 计算各 source_type 的 target 分布
    const byType: Record<string, number> = {};
    for (const target of targetsResult.rows) {
      byType[target.source_type] = (byType[target.source_type] || 0) + 1;
    }

    return NextResponse.json({
      scheduler: {
        status: 'unknown', // running | stopped | unknown
        note: 'Scheduler status requires scheduler process to be running (bun run scheduler)',
      },
      crawlers: crawlersResult.rows,
      stats: {
        targets: {
          total: parseInt(targetStats.enabled_count) + parseInt(targetStats.disabled_count),
          enabled: parseInt(targetStats.enabled_count),
          disabled: parseInt(targetStats.disabled_count),
          by_type: byType,
        },
        crawlers: {
          total: parseInt(crawlerStats.enabled_count) + parseInt(crawlerStats.disabled_count),
          enabled: parseInt(crawlerStats.enabled_count),
          disabled: parseInt(crawlerStats.disabled_count),
          success: parseInt(crawlerStats.success_count),
          failed: parseInt(crawlerStats.failed_count),
          running: parseInt(crawlerStats.running_count),
        },
      },
      targets: targetsResult.rows,
      recent_runs: runsResult.rows,
    });
  } catch (err) {
    console.error('Scheduler status error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch scheduler status' },
      { status: 500 }
    );
  }
}
