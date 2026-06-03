/**
 * 调度器重载 API
 * 用于触发调度器重载任务（配合外部调度器进程）
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function POST(_request: NextRequest) {
  try {
    // 检查数据库连接
    const result = await query('SELECT NOW() as now');
    const dbTime = result.rows[0].now;

    // 获取当前启用的目标数量
    const targetsResult = await query(
      'SELECT COUNT(*) as count FROM crawl_targets WHERE enabled = true'
    );
    const enabledCount = parseInt(targetsResult.rows[0].count, 10);

    // 记录重载事件到系统日志
    await query(
      `INSERT INTO system_events (event_type, source, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        'scheduler_reload_requested',
        'web_api',
        `Scheduler reload requested via API, ${enabledCount} targets enabled`,
        JSON.stringify({ enabled_targets: enabledCount }),
      ]
    );

    // 注意：实际的重载需要调度器进程配合
    // 这里返回当前状态，调度器进程可以通过轮询检测到变更
    return NextResponse.json({
      success: true,
      message: 'Reload request recorded',
      database_time: dbTime,
      enabled_targets: enabledCount,
      note: 'Scheduler will detect changes on next poll (within 60s)',
    });
  } catch (err) {
    console.error('Scheduler reload error:', err);
    return NextResponse.json(
      { error: 'Failed to process reload request' },
      { status: 500 }
    );
  }
}
