/**
 * 立即触发任务 API（按 source_type）
 * 用于手动触发特定爬虫类型的抓取
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_type } = body;

    if (!source_type || typeof source_type !== 'string') {
      return NextResponse.json(
        { error: 'source_type is required and must be a string' },
        { status: 400 }
      );
    }

    // 检查爬虫调度配置是否存在且启用
    const scheduleResult = await query(
      `SELECT source_type, enabled, last_run_status
       FROM crawler_schedules WHERE source_type = $1`,
      [source_type]
    );

    if (scheduleResult.rowCount === 0) {
      return NextResponse.json(
        { error: `Crawler ${source_type} not found` },
        { status: 404 }
      );
    }

    const schedule = scheduleResult.rows[0];

    if (!schedule.enabled) {
      return NextResponse.json(
        { error: `Crawler ${source_type} is disabled` },
        { status: 400 }
      );
    }

    // 检查是否已在运行中
    if (schedule.last_run_status === 'running') {
      return NextResponse.json(
        { error: `Crawler ${source_type} is already running` },
        { status: 409 }
      );
    }

    // 记录触发事件
    await query(
      `INSERT INTO system_events (event_type, source, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        'manual_trigger_requested',
        'web_api',
        `Manual trigger for crawler ${source_type}`,
        JSON.stringify({
          source_type,
        }),
      ]
    );

    // 更新爬虫状态为 pending
    await query(
      `UPDATE crawler_schedules 
       SET last_run_status = $1, updated_at = NOW()
       WHERE source_type = $2`,
      ['pending', source_type]
    );

    return NextResponse.json({
      success: true,
      message: `Trigger request recorded for ${source_type}`,
      crawler: {
        type: source_type,
      },
      note: 'Task will be executed by scheduler process on next poll (within 60s)',
    });
  } catch (err) {
    console.error('Manual trigger error:', err);
    return NextResponse.json(
      { error: 'Failed to process trigger request' },
      { status: 500 }
    );
  }
}
