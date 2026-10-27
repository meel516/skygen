import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

export async function GET() {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  const result = await db.query(
    `SELECT id, name, description, category, "isPublic", "isFreeTier", "previewUrl", "createdAt"
     FROM "Template" ORDER BY "createdAt" DESC`
  );
  return NextResponse.json({ templates: result.rows });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  const { id, isPublic, isFreeTier, category, previewUrl } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (isPublic !== undefined) {
    updates.push(`"isPublic" = $${paramIndex++}`);
    values.push(isPublic);
  }
  if (isFreeTier !== undefined) {
    updates.push(`"isFreeTier" = $${paramIndex++}`);
    values.push(isFreeTier);
  }
  if (category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(category);
  }
  if (previewUrl !== undefined) {
    updates.push(`"previewUrl" = $${paramIndex++}`);
    values.push(previewUrl);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.push(`"updatedAt" = now()`);
  values.push(id);

  await db.query(
    `UPDATE "Template" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  return NextResponse.json({ success: true });
}
