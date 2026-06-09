/**
 * 直接执行 SQL 接口
 * 接收 { key, sql }，key 与 api_keys 表比对鉴权，通过后执行 sql
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

interface ApiKeyRow {
  id: number;
  enabled: boolean;
}

export async function POST(request: NextRequest) {
  let body: { key?: string; sql?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { key, sql } = body;

  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  if (!sql || typeof sql !== 'string' || sql.trim() === '') {
    return NextResponse.json({ error: 'sql is required' }, { status: 400 });
  }

  // 鉴权：与 api_keys 表比对
  let keyRow: ApiKeyRow | undefined;
  try {
    const auth = await query<ApiKeyRow>(
      'SELECT id, enabled FROM api_keys WHERE key = $1',
      [key]
    );
    keyRow = auth.rows[0];
  } catch (err) {
    console.error('Failed to verify api key:', err);
    return NextResponse.json({ error: 'Failed to verify key' }, { status: 500 });
  }

  if (!keyRow || !keyRow.enabled) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 执行 SQL
  try {
    const result = await query(sql);
    // 更新最后使用时间（失败不影响主流程）
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [keyRow.id]).catch(
      () => undefined
    );

    return NextResponse.json({
      command: result.command,
      rowCount: result.rowCount,
      rows: result.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SQL execution failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
