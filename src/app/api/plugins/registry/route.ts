// ============================================================================
// PLUGINS REGISTRY API
// Core plugins → filesystem (_registry.json)
// Custom plugins → database (installed by users)
// ============================================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { derivePluginTags, parseTags } from '@/lib/plugins/tags';
import { isPluginPreviewVideoUrl } from '@/lib/plugins/preview-url';

export async function GET() {
  try {
    const plugins: Record<string, unknown>[] = [];
    const categories: Record<string, string[]> = {};
    let previewUrls: Record<string, string> = {};

    try {
      const previewConfig = await db.query(`SELECT value FROM site_config WHERE key = 'plugin_preview_urls'`);
      const configuredValue = previewConfig.rows[0]?.value;
      if (configuredValue && typeof configuredValue === 'object' && !Array.isArray(configuredValue)) {
        previewUrls = Object.fromEntries(
          Object.entries(configuredValue).filter((entry): entry is [string, string] => isPluginPreviewVideoUrl(entry[1]))
        );
      }
    } catch { /* config may not exist yet */ }

    // 1) Core plugins from filesystem
    const registryPath = path.join(process.cwd(), 'plugins', '_registry.json');
    if (fs.existsSync(registryPath)) {
      try {
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        plugins.push(...(registry.plugins ?? []).map((plugin: Record<string, unknown>) => ({
          ...plugin,
          previewUrl: previewUrls[plugin.id as string] || plugin.previewUrl,
        })));
        Object.assign(categories, registry.categories ?? {});
      } catch { /* malformed json, skip */ }
    }

    // 2) Custom plugins from DB (user-installed)
    try {
      const result = await db.query(
        'SELECT id, name, description, version, category, icon, color, status, tags, likes_count FROM plugins'
      );
      for (const row of result.rows) {
        if (plugins.some(p => p.id === row.id)) continue;
        const tags = parseTags(row.tags);
        plugins.push({
          id: row.id,
          name: row.name,
          category: row.category,
          icon: row.icon,
          color: row.color,
          description: row.description,
          version: row.version,
          status: row.status,
          tags: tags.length > 0 ? tags : derivePluginTags(row),
          likesCount: row.likes_count ?? 0,
          previewUrl: previewUrls[row.id],
        });
        const cat = row.category ?? 'other';
        if (!categories[cat]) categories[cat] = [];
        if (!categories[cat].includes(row.id)) categories[cat].push(row.id);
      }
    } catch { /* DB not ready yet */ }

    return NextResponse.json({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      plugins,
      categories,
    });
  } catch (error) {
    console.error('Failed to load plugin registry:', error);
    return NextResponse.json(
      { error: 'Failed to load plugin registry' },
      { status: 500 }
    );
  }
}
