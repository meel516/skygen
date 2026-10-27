/**
 * POST /api/ai/wizard/save-plugin-manual
 *
 * UI-only path: save the current pendingPlugin as a NEW library plugin
 * (remix-style unique id) without AI and WITHOUT clearing pendingPlugin.
 *
 * Agent buildAndSavePlugin is unchanged (still clears pending on success).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';
import { createPluginFromSource } from '@/lib/plugins/create-plugin';
import { normalizePluginId } from '@/lib/plugins/utils';
import { randomBytes } from 'crypto';

export const maxDuration = 300;

function remixPluginId(displayName: string, fallbackId: string): string {
  const base =
    normalizePluginId(displayName) ||
    normalizePluginId(fallbackId) ||
    'plugin';
  const short = base.length >= 3 ? base.slice(0, 48) : `plugin-${base}`;
  const suffix = randomBytes(3).toString('hex');
  return `${short}-remix-${suffix}`;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  try {
    const body = await req.json();
    const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : '';
    const nameRaw = typeof body.name === 'string' ? body.name.trim() : '';

    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
    }
    if (!nameRaw || nameRaw.length < 2) {
      return NextResponse.json({ error: 'name is required (at least 2 characters)' }, { status: 400 });
    }

    const job = await getJob(threadId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found for this thread' }, { status: 404 });
    }

    // Optional ownership check when job has user_id
    if (job.user_id && job.user_id !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pending = (job.state as any)?.pendingPlugin;
    if (!pending?.pluginId) {
      return NextResponse.json(
        { error: 'No pending plugin in this chat. Wait for a plugin preview first.' },
        { status: 400 },
      );
    }

    const sceneCode = pending.sceneCode ?? pending.modules?.['Scene.tsx'] ?? '';
    if (!sceneCode || typeof sceneCode !== 'string') {
      return NextResponse.json({ error: 'Pending plugin has no Scene.tsx source' }, { status: 400 });
    }

    const schemaJson = pending.schemaJson ?? '{}';
    const pluginId = remixPluginId(nameRaw, pending.pluginId);
    const description =
      (typeof pending.description === 'string' && pending.description.trim()) ||
      `Manual save from chat draft (${pending.pluginName || pending.pluginId})`;

    const result = await createPluginFromSource({
      id: pluginId,
      name: nameRaw,
      description,
      category: pending.category || 'custom',
      sceneCode,
      modules: pending.modules ?? undefined,
      schemaJson,
      dependencies: pending.dependencies ?? {},
      userId: session.user.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          errors: result.errors ?? [],
        },
        { status: result.status || 500 },
      );
    }

    // IMPORTANT: do NOT clear pendingPlugin — draft session continues.
    try {
      await patchJobState(threadId, (current: any) => ({
        ...current,
        lastManualPluginSave: {
          pluginId: result.pluginId,
          name: result.name,
          savedAt: new Date().toISOString(),
          fromPendingId: pending.pluginId,
        },
      }));
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      ok: true,
      pluginId: result.pluginId,
      name: result.name,
      builtInSandbox: result.builtInSandbox,
      warnings: result.warnings ?? [],
      pendingPreserved: true,
      message: `Saved as new plugin "${result.name}" (${result.pluginId}). Chat draft/preview is unchanged — you can keep editing.`,
      blockUsage: { type: 'custom-plugin', pluginId: result.pluginId },
    });
  } catch (e: any) {
    console.error('[save-plugin-manual]', e?.message || e);
    return NextResponse.json(
      { error: e?.message ?? 'Manual plugin save failed' },
      { status: 500 },
    );
  }
}
