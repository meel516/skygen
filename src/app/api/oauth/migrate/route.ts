import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await db.query(`ALTER TABLE oauth_authorization_codes ADD COLUMN IF NOT EXISTS code_challenge TEXT, ADD COLUMN IF NOT EXISTS code_challenge_method TEXT;`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
