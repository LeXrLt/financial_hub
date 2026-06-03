/**
 * 立即触发任务 API
 * 用于手动触发特定 target 的抓取
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target_id } = body;

    if (!target_id || typeof target_id !== 'number') {
      return NextResponse.json(
        { error: 'target_id is required and must be a number' },
        { status: 400 }
      );
    }

    // 检查目标是否存在且启用
    const targetResult = await query(
      `SELECT id, target_name, source_type, enabled, last_crawl_status
       FROM crawl_targets WHERE id = $1`,
      [target_id]
    );

    if (targetResult.rowCount === 0) {
      return NextResponse.json(
        { error: `Target ${target_id} not found` },
        { status: 404 }
      );
    }

    const target = targetResult.rows[0];

    if (!target.enabled) {
      return NextResponse.json(
        { error: `Target ${target_id} is disabled` },
        { status: 400 }
      );
    }

    // 检查是否已在运行中
    if (target.last_crawl_status === 'running') {
      return NextResponse.json(
        { error: `Target ${target_id} is already running` },
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
        `Manual trigger for target ${target_id} (${target.target_name})`,
        JSON.stringify({
          target_id,
          source_type: target.source_type,
          target_name: target.target_name,
        }),
      ]
    );

    // 创建运行记录（标记为 pending，等待调度器执行）
    const runResult = await query(
      `INSERT INTO crawl_runs (target_id, status, started_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [target_id, 'pending']
    );

    const runId = runResult.rows[0].id;

    // 更新目标状态
    await query(
      `UPDATE crawl_targets 
       SET last_crawl_status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['pending', target_id]
    );

    return NextResponse.json({
      success: true,
      message: `Trigger request recorded for target ${target_id}`,
      run_id: runId,
      target: {
        id: target.id,
        name: target.target_name,
        type: target.source_type,
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
