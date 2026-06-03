/**
 * 爬虫调度管理 API
 * 获取和更新爬虫调度配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

interface CrawlerSchedule {
  id: number;
  source_type: string;
  enabled: boolean;
  cron_expression: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// 获取所有爬虫调度配置
export async function GET() {
  try {
    const result = await query<CrawlerSchedule>(
      `SELECT id, source_type, enabled, cron_expression, 
              last_run_at, last_run_status, last_error,
              created_at, updated_at
       FROM crawler_schedules 
       ORDER BY source_type`
    );

    return NextResponse.json({ crawlers: result.rows });
  } catch (err) {
    console.error('Failed to fetch crawler schedules:', err);
    return NextResponse.json(
      { error: 'Failed to fetch crawler schedules' },
      { status: 500 }
    );
  }
}

// 更新爬虫调度配置
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_type, enabled, cron_expression } = body;

    if (!source_type) {
      return NextResponse.json(
        { error: 'source_type is required' },
        { status: 400 }
      );
    }

    // 验证 cron 表达式格式（简单验证）
    if (cron_expression !== undefined) {
      const cronRegex = /^[\d\*,/-]+\s+[\d\*,/-]+\s+[\d\*,/-]+\s+[\d\*,/-]+\s+[\d\*,/-]+$/;
      if (!cronRegex.test(cron_expression)) {
        return NextResponse.json(
          { error: 'Invalid cron expression format' },
          { status: 400 }
        );
      }
    }

    const result = await query<CrawlerSchedule>(
      `UPDATE crawler_schedules 
       SET enabled = COALESCE($1, enabled),
           cron_expression = COALESCE($2, cron_expression),
           updated_at = NOW()
       WHERE source_type = $3
       RETURNING *`,
      [enabled, cron_expression, source_type]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: `Crawler ${source_type} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ crawler: result.rows[0] });
  } catch (err) {
    console.error('Failed to update crawler schedule:', err);
    return NextResponse.json(
      { error: 'Failed to update crawler schedule' },
      { status: 500 }
    );
  }
}

// 切换爬虫启用状态
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_type } = body;

    if (!source_type) {
      return NextResponse.json(
        { error: 'source_type is required' },
        { status: 400 }
      );
    }

    const result = await query<CrawlerSchedule>(
      `UPDATE crawler_schedules 
       SET enabled = NOT enabled,
           updated_at = NOW()
       WHERE source_type = $1
       RETURNING *`,
      [source_type]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: `Crawler ${source_type} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ crawler: result.rows[0] });
  } catch (err) {
    console.error('Failed to toggle crawler:', err);
    return NextResponse.json(
      { error: 'Failed to toggle crawler' },
      { status: 500 }
    );
  }
}
