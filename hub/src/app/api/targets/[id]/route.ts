import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const result = await query('DELETE FROM crawl_targets WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { target_name, target_identifier, cron_expression, enabled, notes } = body;

    const result = await query(
      `UPDATE crawl_targets 
       SET target_name = COALESCE($1, target_name),
           target_identifier = COALESCE($2, target_identifier),
           cron_expression = COALESCE($3, cron_expression),
           enabled = COALESCE($4, enabled),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [target_name, target_identifier, cron_expression, enabled, notes, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update target' }, { status: 500 });
  }
}
