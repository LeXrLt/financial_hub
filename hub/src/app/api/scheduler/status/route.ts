/**
 * 调度器状态 API
 * 获取调度器和抓取目标的当前状态
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export const dynamic = 'force-dynamic';

interface TargetStatus {
  id: number;
  source_type: string;
  target_name: string;
  enabled: boolean;
  cron_expression: string;
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
    // 获取所有目标状态
    const targetsResult = await query<TargetStatus>(
      `SELECT 
        id, source_type, target_name, enabled, 
        cron_expression, last_crawl_at, last_crawl_status, total_items
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

    // 统计信息
    const statsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
        COUNT(*) FILTER (WHERE enabled = false) as disabled_count,
        COUNT(*) FILTER (WHERE last_crawl_status = 'success') as success_count,
        COUNT(*) FILTER (WHERE last_crawl_status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE last_crawl_status = 'running') as running_count
      FROM crawl_targets
    `);

    const stats = statsResult.rows[0];

    // 计算各 source_type 的分布
    const byType: Record<string, number> = {};
    for (const target of targetsResult.rows) {
      byType[target.source_type] = (byType[target.source_type] || 0) + 1;
    }

    return NextResponse.json({
      scheduler: {
        // 注意：这里的 running 状态需要调度器进程配合
        // 在没有调度器进程时显示为 unknown
        status: 'unknown', // running | stopped | unknown
        note: 'Scheduler status requires scheduler process to be running (bun run scheduler)',
      },
      stats: {
        total: parseInt(stats.enabled_count) + parseInt(stats.disabled_count),
        enabled: parseInt(stats.enabled_count),
        disabled: parseInt(stats.disabled_count),
        success: parseInt(stats.success_count),
        failed: parseInt(stats.failed_count),
        running: parseInt(stats.running_count),
        by_type: byType,
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
