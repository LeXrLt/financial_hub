import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const result = await query(
      `UPDATE crawl_targets SET enabled = NOT enabled, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to toggle target' }, { status: 500 });
  }
}
