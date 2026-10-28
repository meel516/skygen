import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getSignedS3Url } from '@/lib/s3';
import { createPluginFromSource } from '@/lib/plugins/create-plugin';
import { createRemixPluginId } from '@/lib/plugins/remix-id';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) return authResult.response;
    const { session } = authResult as { session: { user: { id: string } } };
    const userId = session.user.id;

    const { id: pluginId } = await params;
    if (!pluginId) {
      return NextResponse.json({ error: 'Plugin ID is required' }, { status: 400 });
    }

    // 1. Fetch existing plugin
    const result = await db.query('SELECT * FROM plugins WHERE id = $1', [pluginId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const existingPlugin = result.rows[0];

    // 2. Fetch source.json from S3
    const sourceS3Key = `plugins/${pluginId}/source.json`;
    let sourceJson;
    try {
      const url = await getSignedS3Url(sourceS3Key, 60);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch source: ${res.statusText}`);
      }
      sourceJson = await res.json();
    } catch (e: any) {
      console.error(`[fork-plugin] Failed to fetch source for ${pluginId}:`, e.message);
      return NextResponse.json({ 
        error: 'Source code not available for this plugin. Only plugins created after the source code update can be remixed.' 
      }, { status: 400 });
    }

    // 3. Prepare new plugin data
    const newPluginId = createRemixPluginId(pluginId);
    const newName = `Copy of ${existingPlugin.name}`;

    const { sceneCode, modules, dependencies } = sourceJson;

    // 4. Create new plugin
    const createResult = await createPluginFromSource({
      id: newPluginId,
      name: newName,
      description: existingPlugin.description,
      category: existingPlugin.category,
      sceneCode,
      modules,
      schemaJson: existingPlugin.schema_json,
      dependencies,
      userId,
    });

    if (!createResult.ok) {
      return NextResponse.json({ error: createResult.error, errors: createResult.errors }, { status: createResult.status });
    }

    return NextResponse.json({ 
      pluginId: createResult.pluginId,
      name: createResult.name
    });

  } catch (error: any) {
    console.error('[fork-plugin] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to fork plugin' }, { status: 500 });
  }
}
