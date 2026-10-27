import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { patchJobState, getJob } from '@/lib/mcp/wizard-jobs';
import { createHash } from 'crypto';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function computePendingPluginSourceHash(pending: Record<string, any>): string {
  return createHash('sha256')
    .update(stableStringify({
      sceneCode: pending.sceneCode ?? '',
      modules: pending.modules ?? null,
      schemaJson: pending.schemaJson ?? '',
      dependencies: pending.dependencies ?? {},
    }))
    .digest('hex')
    .slice(0, 16);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  try {
    const body = await req.json();
    const { threadId, file, code, action } = body;

    if (!threadId || !file || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing threadId, file, or code' }, { status: 400 });
    }

    const job = await getJob(threadId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const state = job.state || {};
    if (!state.pendingPlugin) {
      return NextResponse.json({ error: 'No active plugin session to edit' }, { status: 400 });
    }

    await patchJobState(threadId, (current) => {
      const pendingPlugin = { ...(current.pendingPlugin || {}) };
      const modules = { ...(pendingPlugin.modules || {}) };
      
      // Update or add the code for the specific file
      modules[file] = code;
      pendingPlugin.modules = modules;

      // If the file is Scene.tsx, also update the legacy root sceneCode property just in case
      if (file === 'Scene.tsx') {
        pendingPlugin.sceneCode = code;
      }

      // CRITICAL: Invalidate the Recon Gate so the Orchestrator recalculates hashes and AST
      pendingPlugin.lastReconAt = null;

      // Update hashes so buildAndSavePlugin doesn't block
      const newSourceHash = computePendingPluginSourceHash(pendingPlugin);
      pendingPlugin.previewSourceHash = newSourceHash;
      pendingPlugin.lastCompiledSourceHash = newSourceHash;

      // Add audit event to the ledger so the AI knows what happened
      const runLedger = pendingPlugin.runLedger ? { ...pendingPlugin.runLedger } : undefined;
      if (runLedger) {
        const events = [...(runLedger.events || [])];
        const actionVerb = action === 'add' ? 'added' : 'edited';
        events.push({
          type: 'edit',
          summary: `Human manually ${actionVerb} ${file} via frontend editor.`,
          at: new Date().toISOString()
        });
        
        // Keep the ledger size reasonable
        if (events.length > 50) {
          events.splice(0, events.length - 50);
        }
        
        runLedger.events = events;
        pendingPlugin.runLedger = runLedger;
      }

      return {
        ...current,
        pendingPlugin
      };
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[/api/ai/wizard/manual-code-edit]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
