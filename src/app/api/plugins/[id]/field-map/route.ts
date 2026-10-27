// ============================================================================
// PLUGIN FIELD MAP API
// GET  /api/plugins/[id]/field-map  — generation_fields + schema path suggestions
// PUT  /api/plugins/[id]/field-map  — user-editable wizard media map (additional to auto-extract)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthenticatedSession } from '@/lib/api-security';
import {
  convertLegacyGenerationFields,
  isLegacyGenerationFields,
} from '@/lib/plugins/extract-normalized-fields';
import type { NormalizedMediaField } from '@/lib/video/ai/mastra/shared/utils';

const MEDIA_TYPES = new Set(['image', 'audio', 'video']);

function collectSchemaPaths(
  properties: Record<string, any>,
  prefix = '',
): { path: string; typeHint?: string; description?: string; editor?: string }[] {
  const out: { path: string; typeHint?: string; description?: string; editor?: string }[] = [];
  if (!properties || typeof properties !== 'object') return out;

  for (const [key, prop] of Object.entries(properties)) {
    if (!prop || typeof prop !== 'object') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const editor = typeof prop.editor === 'string' ? prop.editor : undefined;
    const description = prop.description ?? prop.title ?? '';

    if (prop.type === 'array' && prop.items?.properties) {
      out.push({
        path: `${path}[]`,
        typeHint: 'array',
        description: prop.description ?? prop.title,
      });
      for (const [nk, np] of Object.entries(prop.items.properties as Record<string, any>)) {
        const nestedPath = `${path}[].${nk}`;
        const nEditor = typeof (np as any).editor === 'string' ? (np as any).editor : undefined;
        out.push({
          path: nestedPath,
          typeHint: nEditor && MEDIA_TYPES.has(nEditor) ? nEditor : (np as any).type,
          description: (np as any).description ?? (np as any).title ?? '',
          editor: nEditor,
        });
        // also suggest concrete indices 0..4 for wizard slots
        for (let i = 0; i < 5; i++) {
          out.push({
            path: `${path}[${i}].${nk}`,
            typeHint: nEditor && MEDIA_TYPES.has(nEditor) ? nEditor : (np as any).type,
            description: (np as any).description ?? (np as any).title ?? `Item ${i + 1} ${nk}`,
            editor: nEditor,
          });
        }
      }
      continue;
    }

    if (prop.type === 'object' && prop.properties) {
      out.push(...collectSchemaPaths(prop.properties as Record<string, any>, path));
      continue;
    }

    out.push({
      path,
      typeHint: editor && MEDIA_TYPES.has(editor) ? editor : prop.type,
      description,
      editor,
    });
  }
  return out;
}

function normalizeIncomingFields(raw: unknown): NormalizedMediaField[] | { error: string } {
  if (!Array.isArray(raw)) return { error: 'fields must be an array' };
  const fields: NormalizedMediaField[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const path = String((item as any).path ?? '').trim();
    const type = String((item as any).type ?? '').trim() as NormalizedMediaField['type'];
    const description = String((item as any).description ?? '').trim();
    const removeBackground = !!(item as any).removeBackground;

    if (!path) return { error: 'Each field needs a non-empty path' };
    if (!MEDIA_TYPES.has(type)) {
      return { error: `Invalid type "${type}" for path "${path}" (use image|audio|video)` };
    }
    if (seen.has(path)) continue;
    seen.add(path);
    fields.push({ path, type, description, removeBackground });
  }
  return fields;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  try {
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid plugin id' }, { status: 400 });
    }

    const result = await db.query(
      `SELECT id, name, schema_json, generation_fields, tags FROM plugins WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const row = result.rows[0];
    let schema: Record<string, any> = {};
    try {
      schema = typeof row.schema_json === 'string' ? JSON.parse(row.schema_json) : row.schema_json ?? {};
    } catch {
      schema = {};
    }

    let fields: NormalizedMediaField[] = [];
    const raw = row.generation_fields;
    if (isLegacyGenerationFields(raw)) {
      fields = convertLegacyGenerationFields(raw);
    } else if (Array.isArray(raw)) {
      fields = raw as NormalizedMediaField[];
    }

    const suggestions = collectSchemaPaths((schema.properties ?? {}) as Record<string, any>);

    return NextResponse.json({
      pluginId: row.id,
      name: row.name,
      tags: Array.isArray(row.tags) ? row.tags : [],
      fields,
      suggestions,
      schemaPropertyKeys: Object.keys(schema.properties ?? {}),
    });
  } catch (error) {
    console.error('[field-map GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load field map' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  try {
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid plugin id' }, { status: 400 });
    }

    const body = await request.json();
    const normalized = normalizeIncomingFields(body.fields);
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    // Optional tags update (catalog tags — additional to field map)
    let tags: string[] | undefined;
    if (Array.isArray(body.tags)) {
      tags = body.tags
        .map((t: unknown) => String(t ?? '').trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 40);
    }

    const exists = await db.query('SELECT id FROM plugins WHERE id = $1', [id]);
    if (!exists.rows[0]) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    if (tags) {
      await db.query(
        `UPDATE plugins
         SET generation_fields = $2::jsonb,
             tags = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [id, JSON.stringify(normalized), tags],
      );
    } else {
      await db.query(
        `UPDATE plugins
         SET generation_fields = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [id, JSON.stringify(normalized)],
      );
    }

    return NextResponse.json({
      ok: true,
      pluginId: id,
      fields: normalized,
      tags: tags ?? undefined,
      message: 'Field map saved. Wizard will use these paths on the next video fill.',
    });
  } catch (error) {
    console.error('[field-map PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save field map' },
      { status: 500 },
    );
  }
}
