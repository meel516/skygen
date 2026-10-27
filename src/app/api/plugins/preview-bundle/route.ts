import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { bundlePreview } from '@/lib/plugins/preview-bundler';
import { normalizePluginDependencies } from '@/lib/plugins/dependency-policy';
import { formatPluginBuildFailure, pluginBuildFailure } from '@/lib/plugins/build-errors';

export const maxDuration = 120;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function sourceHashFor(input: {
  sceneCode?: string;
  modules?: Record<string, string>;
  schemaJson?: string;
  dependencies?: Record<string, string>;
}) {
  return createHash('sha256')
    .update(stableStringify({
      sceneCode: input.sceneCode ?? input.modules?.['Scene.tsx'] ?? '',
      modules: input.modules ?? null,
      schemaJson: input.schemaJson ?? '',
      dependencies: input.dependencies ?? {},
    }))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Preview build for blob-URL execution in the browser.
 *
 * Delegates to the shared `bundlePreview` helper so the agent's `compilePreview`
 * tool and this HTTP route share the EXACT same esbuild config (no drift between
 * what compiles in the agent loop and what loads in the browser).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sceneCode, pluginId, dependencies, modules, schemaJson, threadId } = body;

  const isMcpPreview = typeof threadId === 'string' && threadId.includes('mcp_preview_');
  if (!isMcpPreview) {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) return authResult.response;
  }

  if ((!sceneCode && !modules?.['Scene.tsx']) || !pluginId) {
    return NextResponse.json({ error: 'Missing sceneCode or pluginId' }, { status: 400 });
  }

  try {
    const depPolicy = normalizePluginDependencies(dependencies);
    const normalizedDependencies = depPolicy.dependencies;
    const sourceHash = sourceHashFor({ sceneCode, modules, schemaJson, dependencies: normalizedDependencies });
    const result = await bundlePreview(sceneCode ?? modules?.['Scene.tsx'] ?? '', pluginId, {
      dependencies: normalizedDependencies,
      modules,
    });

    if (!result.ok) {
      console.error('[preview-bundle] build failed:', result.error);
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json({
      bundleJs: result.bundleJs,
      sourceHash,
      previewBuildId: `${sourceHash}-${Date.now().toString(36)}`,
      bundleBytes: result.bundleJs.length,
      dependencies: normalizedDependencies,
      dependencyPolicy: {
        stripped: depPolicy.stripped,
        normalized: depPolicy.normalized,
      },
    });
  } catch (error) {
    const buildError = pluginBuildFailure(error, 'setup');
    return NextResponse.json({ ok: false, error: formatPluginBuildFailure(buildError), buildError }, { status: 422 });
  }
}
