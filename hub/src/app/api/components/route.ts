import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/query';

export async function GET() {
  try {
    const result = await query('SELECT * FROM component_status ORDER BY component_name');
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 });
  }
}

// Heartbeat endpoint for crawlers to report their status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { component_name, status, metadata } = body;

    if (!component_name || !status) {
      return NextResponse.json(
        { error: 'component_name and status are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO component_status (component_name, status, last_heartbeat, metadata, updated_at)
       VALUES ($1, $2, NOW(), $3, NOW())
       ON CONFLICT (component_name)
       DO UPDATE SET status = $2, last_heartbeat = NOW(), metadata = COALESCE($3, component_status.metadata), updated_at = NOW()
       RETURNING *`,
      [component_name, status, metadata ? JSON.stringify(metadata) : '{}']
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update component status' }, { status: 500 });
  }
}
