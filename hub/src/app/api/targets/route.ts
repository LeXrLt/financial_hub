import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM crawl_targets ORDER BY source_type, target_name'
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_type, target_name, target_identifier, cron_expression, notes } = body;

    if (!source_type || !target_name || !target_identifier) {
      return NextResponse.json(
        { error: 'source_type, target_name, target_identifier are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO crawl_targets (source_type, target_name, target_identifier, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [source_type, target_name, target_identifier, notes || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
  }
}
