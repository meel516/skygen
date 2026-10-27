import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';
import { createPluginFromSource } from '@/lib/plugins/create-plugin';
import { normalizePluginId } from '@/lib/plugins/utils';
import { randomBytes } from 'crypto';

export const maxDuration = 300;

function remixPluginId(displayName: string, fallbackId: string): string {
  const base = normalizePluginId(displayName) || normalizePluginId(fallbackId) || 'plugin';
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

    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
    }

    const job = await getJob(threadId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found for this thread' }, { status: 404 });
    }

    if (job.user_id && job.user_id !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pending = (job.state as any)?.pendingPlugin;
    if (!pending?.pluginId) {
      return NextResponse.json(
        { error: 'No pending plugin found in this thread.' },
        { status: 400 },
      );
    }

    const sceneCode = pending.sceneCode ?? pending.modules?.['Scene.tsx'] ?? '';
    if (!sceneCode || typeof sceneCode !== 'string') {
      return NextResponse.json({ error: 'Pending plugin has no Scene.tsx source' }, { status: 400 });
    }

    const schemaJson = pending.schemaJson ?? '{}';
    const nameRaw = pending.pluginName || 'Approved Plugin';
    const pluginId = remixPluginId(nameRaw, pending.pluginId);

    const result = await createPluginFromSource({
      id: pluginId,
      name: nameRaw,
      description: pending.description || `Approved from MCP preview (${pending.pluginId})`,
      category: pending.category || 'custom',
      sceneCode,
      modules: pending.modules ?? undefined,
      schemaJson,
      dependencies: pending.dependencies ?? {},
      userId: session.user.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, errors: result.errors ?? [] },
        { status: result.status || 500 },
      );
    }

    // Update job state so the UI knows it was saved
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
      // non-fatal
    }

    return NextResponse.json({
      success: true,
      pluginId: result.pluginId,
      name: result.name,
      builtInSandbox: result.builtInSandbox,
      warnings: result.warnings ?? [],
      message: `Successfully approved and built plugin "${result.name}" (${result.pluginId}).`,
      usage: { type: 'custom-plugin', pluginId: result.pluginId, pluginData: {} },
    });
  } catch (e: any) {
    console.error('[approve-preview] Failed:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Failed to approve plugin preview' },
      { status: 500 },
    );
  }
}
