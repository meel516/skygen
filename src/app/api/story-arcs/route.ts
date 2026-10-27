import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Ensure table exists with defaults
    await db.query(`
      CREATE TABLE IF NOT EXISTS story_arcs (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        emoji TEXT NOT NULL DEFAULT '📋',
        description TEXT NOT NULL DEFAULT '',
        is_premium BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const { rows } = await db.query(
      'SELECT id, label, emoji, description, is_premium FROM story_arcs WHERE is_active = true ORDER BY sort_order ASC'
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
