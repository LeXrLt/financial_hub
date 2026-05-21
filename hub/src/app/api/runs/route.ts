import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function GET() {
  try {
    const result = await query(
      `SELECT cr.*, ct.target_name, ct.source_type
       FROM crawl_runs cr
       JOIN crawl_targets ct ON cr.target_id = ct.id
       ORDER BY cr.started_at DESC
       LIMIT 100`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}

// Called by crawlers to report a run
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target_id, status, items_found, items_new, items_failed, error_message, duration_ms } = body;

    if (!target_id) {
      return NextResponse.json({ error: 'target_id is required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO crawl_runs (target_id, status, items_found, items_new, items_failed, error_message, duration_ms, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $2 != 'running' THEN NOW() ELSE NULL END)
       RETURNING *`,
      [target_id, status || 'running', items_found || 0, items_new || 0, items_failed || 0, error_message, duration_ms]
    );

    // Update target's last crawl info
    if (status && status !== 'running') {
      await query(
        `UPDATE crawl_targets 
         SET last_crawl_at = NOW(), 
             last_crawl_status = $1, 
             last_error = $2,
             total_items = total_items + $3,
             updated_at = NOW()
         WHERE id = $4`,
        [status, error_message, items_new || 0, target_id]
      );
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }
}
