import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSignedS3Url } from '@/lib/s3';
import { requireAuthenticatedSession } from '@/lib/api-security';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) return authResult.response;
    const { session } = authResult as { session: { user: { id: string } } };

    const { id: pluginId } = await params;
    
    const result = await db.query(
      'SELECT name, schema_json FROM plugins WHERE id = $1 AND user_id = $2',
      [pluginId, session.user.id],
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }
    const dbPlugin = result.rows[0];

    // Fetch source from S3
    const sourceS3Key = `plugins/${pluginId}/source.json`;
    let sourceJson;
    try {
      const url = await getSignedS3Url(sourceS3Key, 60);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('S3 fetch failed');
      sourceJson = await res.json();
    } catch {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json({
      pluginId,
      pluginName: dbPlugin.name,
      schemaJson: dbPlugin.schema_json || '{}',
      sceneCode: sourceJson.sceneCode || '',
      modules: sourceJson.modules || null,
      dependencies: sourceJson.dependencies || {},
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
