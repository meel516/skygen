/**
 * POST /api/ai/wizard/plugin-sandbox
 *
 * Additive Remotion-plugin sandbox controls for the chat pending draft:
 *   - list files + dependencies
 *   - upsert / delete modules (create new files)
 *   - set dependencies (dependencies.json body)
 *   - install: same sandbox path as preview-bundle (npm install + esbuild)
 *
 * Does NOT change agent tools or buildAndSavePlugin (still clears pending on agent save).
 * Does NOT clear pendingPlugin on install.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';
import { bundlePreview } from '@/lib/plugins/preview-bundler';
import { normalizePluginDependencies } from '@/lib/plugins/dependency-policy';

export const maxDuration = 180;

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

function safeModulePath(file: string): string | null {
  if (typeof file !== 'string') return null;
  const cleaned = file.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!cleaned || cleaned.includes('..') || cleaned.startsWith('node_modules/')) return null;
  if (!/^[\w./\-]+$/.test(cleaned)) return null;
  if (!/\.(tsx?|jsx?|css|json)$/i.test(cleaned) && cleaned !== 'dependencies.json') {
    // allow dependencies.json as special meta via set-dependencies action
    if (!cleaned.endsWith('.tsx') && !cleaned.endsWith('.ts') && !cleaned.endsWith('.jsx') && !cleaned.endsWith('.js') && !cleaned.endsWith('.css') && !cleaned.endsWith('.json')) {
      return null;
    }
  }
  return cleaned;
}

function summarizePending(pending: Record<string, any>) {
  const modules = pending.modules && typeof pending.modules === 'object'
    ? pending.modules as Record<string, string>
    : pending.sceneCode
      ? { 'Scene.tsx': pending.sceneCode }
      : {};
  const deps = (pending.dependencies && typeof pending.dependencies === 'object')
    ? pending.dependencies as Record<string, string>
    : {};
  return {
    pluginId: pending.pluginId ?? null,
    pluginName: pending.pluginName ?? null,
    files: Object.keys(modules).sort(),
    modules,
    sceneCode: pending.sceneCode ?? modules['Scene.tsx'] ?? '',
    schemaJson: pending.schemaJson ?? '{}',
    dependencies: deps,
    dependenciesJson: JSON.stringify(deps, null, 2),
    sourceHash: computePendingPluginSourceHash({
      ...pending,
      modules,
      dependencies: deps,
    }),
    lastSandboxInstall: pending.lastSandboxInstall ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isMcpPreview = typeof body.threadId === 'string' && body.threadId.includes('mcp_preview_');
    
    let session = null;
    if (!isMcpPreview) {
      const authResult = await requireAuthenticatedSession();
      if ('response' in authResult) return authResult.response;
      session = authResult.session;
    }
    const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : 'list';

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
        { error: 'No pending plugin in this chat. Wait for a plugin preview first.' },
        { status: 400 },
      );
    }

    // ── list ──────────────────────────────────────────────────────────────
    if (action === 'list') {
      return NextResponse.json({ ok: true, action: 'list', ...summarizePending(pending) });
    }

    // ── set-dependencies (dependencies.json body) ─────────────────────────
    if (action === 'set-dependencies') {
      let deps: Record<string, string> = {};
      if (typeof body.dependenciesJson === 'string') {
        try {
          const parsed = JSON.parse(body.dependenciesJson);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return NextResponse.json({ error: 'dependenciesJson must be a JSON object' }, { status: 400 });
          }
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof k === 'string' && typeof v === 'string') deps[k] = v;
          }
        } catch (e: any) {
          return NextResponse.json({ error: `Invalid dependenciesJson: ${e?.message ?? e}` }, { status: 400 });
        }
      } else if (body.dependencies && typeof body.dependencies === 'object') {
        for (const [k, v] of Object.entries(body.dependencies as Record<string, unknown>)) {
          if (typeof k === 'string' && typeof v === 'string') deps[k] = v;
        }
      } else {
        return NextResponse.json({ error: 'Provide dependenciesJson string or dependencies object' }, { status: 400 });
      }

      const policy = normalizePluginDependencies(deps);
      await patchJobState(threadId, (current: any) => {
        const p = { ...(current.pendingPlugin || {}) };
        p.dependencies = policy.dependencies;
        p.lastReconAt = null;
        const hash = computePendingPluginSourceHash(p);
        // Invalidate compile stamps so next preview reinstalls/rebuilds
        p.lastCompiledSourceHash = null;
        p.previewSourceHash = null;
        p.lastCompileOk = false;
        return { ...current, pendingPlugin: p, _sandboxSourceHash: hash };
      });

      const job2 = await getJob(threadId);
      const p2 = (job2?.state as any)?.pendingPlugin;
      return NextResponse.json({
        ok: true,
        action: 'set-dependencies',
        dependencies: policy.dependencies,
        stripped: policy.stripped,
        normalized: policy.normalized,
        pending: p2 ? summarizePending(p2) : null,
        message: 'dependencies.json updated on pending plugin. Click Install (sandbox) then reload preview.',
      });
    }

    // ── upsert-file ───────────────────────────────────────────────────────
    if (action === 'upsert-file') {
      const file = safeModulePath(body.file);
      const code = typeof body.code === 'string' ? body.code : null;
      if (!file || code === null) {
        return NextResponse.json({ error: 'file and code are required' }, { status: 400 });
      }
      if (file === 'dependencies.json') {
        return NextResponse.json({
          error: 'Use action set-dependencies for dependencies.json (not a Remotion module file).',
        }, { status: 400 });
      }

      await patchJobState(threadId, (current: any) => {
        const p = { ...(current.pendingPlugin || {}) };
        const modules = { ...(p.modules || {}) };
        if (!modules['Scene.tsx'] && p.sceneCode) modules['Scene.tsx'] = p.sceneCode;
        modules[file] = code;
        p.modules = modules;
        if (file === 'Scene.tsx') p.sceneCode = code;
        p.lastReconAt = null;
        p.lastCompiledSourceHash = null;
        p.previewSourceHash = null;
        p.lastCompileOk = false;
        return { ...current, pendingPlugin: p };
      });

      const job2 = await getJob(threadId);
      const p2 = (job2?.state as any)?.pendingPlugin;
      return NextResponse.json({
        ok: true,
        action: 'upsert-file',
        file,
        pending: p2 ? summarizePending(p2) : null,
      });
    }

    // ── delete-file ───────────────────────────────────────────────────────
    if (action === 'delete-file') {
      const file = safeModulePath(body.file);
      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }
      if (file === 'Scene.tsx') {
        return NextResponse.json({ error: 'Cannot delete Scene.tsx (entry file)' }, { status: 400 });
      }

      await patchJobState(threadId, (current: any) => {
        const p = { ...(current.pendingPlugin || {}) };
        const modules = { ...(p.modules || {}) };
        delete modules[file];
        p.modules = modules;
        p.lastReconAt = null;
        p.lastCompiledSourceHash = null;
        p.previewSourceHash = null;
        p.lastCompileOk = false;
        return { ...current, pendingPlugin: p };
      });

      const job2 = await getJob(threadId);
      const p2 = (job2?.state as any)?.pendingPlugin;
      return NextResponse.json({
        ok: true,
        action: 'delete-file',
        file,
        pending: p2 ? summarizePending(p2) : null,
      });
    }

    // ── install: same sandbox as preview-bundle ───────────────────────────
    if (action === 'install' || action === 'install-and-preview') {
      const modules = pending.modules && typeof pending.modules === 'object'
        ? { ...pending.modules } as Record<string, string>
        : {};
      if (!modules['Scene.tsx'] && pending.sceneCode) {
        modules['Scene.tsx'] = pending.sceneCode;
      }
      if (!modules['Scene.tsx']) {
        return NextResponse.json({ error: 'No Scene.tsx in pending plugin' }, { status: 400 });
      }

      let deps = (pending.dependencies && typeof pending.dependencies === 'object')
        ? { ...pending.dependencies } as Record<string, string>
        : {};

      // Optional override body for one-shot install
      if (body.dependencies && typeof body.dependencies === 'object') {
        deps = {};
        for (const [k, v] of Object.entries(body.dependencies as Record<string, unknown>)) {
          if (typeof k === 'string' && typeof v === 'string') deps[k] = v;
        }
      }

      const policy = normalizePluginDependencies(deps);
      const pluginId = pending.pluginId as string;

      const result = await bundlePreview(modules['Scene.tsx'], pluginId, {
        dependencies: policy.dependencies,
        modules,
      });

      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          action: 'install',
          error: result.error,
          buildError: result.buildError,
          diagnostics: result.diagnostics,
          message: 'Sandbox install/build failed (same path as preview). Fix dependencies.json or source, then retry.',
        }, { status: 422 });
      }

      const sourceHash = computePendingPluginSourceHash({
        sceneCode: modules['Scene.tsx'],
        modules,
        schemaJson: pending.schemaJson ?? '',
        dependencies: policy.dependencies,
      });

      // Update pending: persist normalized deps + install stamp. Do NOT clear pending.
      await patchJobState(threadId, (current: any) => {
        const p = { ...(current.pendingPlugin || {}) };
        p.dependencies = policy.dependencies;
        p.modules = modules;
        p.sceneCode = modules['Scene.tsx'];
        p.lastSandboxInstall = {
          at: new Date().toISOString(),
          sourceHash,
          bundleBytes: result.bundleJs.length,
          dependencies: policy.dependencies,
          ok: true,
        };
        // Align hashes so preview reload is clean
        p.lastCompiledSourceHash = sourceHash;
        p.previewSourceHash = sourceHash;
        p.lastCompileOk = true;
        p.previewBuildId = `${sourceHash}-sandbox`;
        return { ...current, pendingPlugin: p };
      });

      const job2 = await getJob(threadId);
      const p2 = (job2?.state as any)?.pendingPlugin;

      return NextResponse.json({
        ok: true,
        action: 'install',
        sandbox: 'preview-bundle', // same installer as browser preview
        sourceHash,
        bundleBytes: result.bundleJs.length,
        // Include bundle so UI can refresh Player without a second round-trip
        bundleJs: action === 'install-and-preview' ? result.bundleJs : undefined,
        dependencies: policy.dependencies,
        stripped: policy.stripped,
        pending: p2 ? summarizePending(p2) : null,
        pendingPreserved: true,
        message: `Sandbox installed ${Object.keys(policy.installDependencies).length} third-party package(s) and built preview bundle. Draft kept open.`,
      });
    }

    return NextResponse.json({
      error: `Unknown action: ${action}. Use list | set-dependencies | upsert-file | delete-file | install | install-and-preview`,
    }, { status: 400 });
  } catch (e: any) {
    console.error('[plugin-sandbox]', e?.message || e);
    return NextResponse.json({ error: e?.message ?? 'plugin-sandbox failed' }, { status: 500 });
  }
}
