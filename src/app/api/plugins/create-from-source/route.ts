// ============================================================================
// PLUGIN CREATE-FROM-SOURCE API
// POST /api/plugins/create-from-source
//
// Thin wrapper around the shared createPluginFromSource helper. All logic
// (validation, sandbox build, S3 upload, DB persist) lives in the helper so
// both this route and the mastra `createPlugin` agent tool stay in sync.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createPluginFromSource } from '@/lib/plugins/create-plugin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      category,
      scene_code,
      modules,
      schema_json: schemaJson,
      dependencies,
      user_id: userId,
    } = body as {
      id: string;
      name: string;
      description?: string;
      category?: string;
      scene_code?: string;
      modules?: Record<string, string>;
      schema_json: string;
      dependencies?: Record<string, string>;
      user_id?: string | null;
    };

    const sceneCode = scene_code ?? modules?.['Scene.tsx'] ?? '';

    const result = await createPluginFromSource({
      id, name, description, category, sceneCode, modules, schemaJson, dependencies, userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      pluginId: result.pluginId,
      name: result.name,
      warnings: result.warnings,
      builtInSandbox: result.builtInSandbox,
    });
  } catch (error) {
    console.error('Plugin create-from-source failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plugin creation failed' },
      { status: 500 },
    );
  }
}
