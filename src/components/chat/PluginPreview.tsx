'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Player } from '@remotion/player';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import { CircleNotch, CheckCircle, XCircle, ArrowsClockwise, Code, Copy, DownloadSimple, PencilSimple, FloppyDisk, CloudArrowUp } from '@phosphor-icons/react';
import Editor from '@monaco-editor/react';

type PreviewState = 'idle' | 'loading' | 'ready' | 'error';
type PendingPlugin = NonNullable<ReturnType<typeof useWizardChatStore.getState>['pendingPlugin']>;
type PreviewMeta = { sourceHash: string; previewBuildId: string; bundleBytes: number } | null;
const PLACEHOLDER_IMG = 'https://placehold.co/400x400/1a1a2e/ffffff?text=IMG';

const PREVIEW_FPS = 30;
/** Fallback when schema has no durationSec — longer than the old 5s widget stub. */
const DEFAULT_PREVIEW_DURATION_SEC = 15;
const MIN_PREVIEW_DURATION_SEC = 3;
const MAX_PREVIEW_DURATION_SEC = 120;

export type PreviewAnimation = { enter: number; hold: number; exit: number };

/**
 * Preview length + host animation props.
 * Prefer schema.defaults.durationSec (and optional defaults.animation).
 * Never hardcode 5s — that forced "widget + fade" agent behavior in preview.
 */
function previewTimingFromSchema(schemaJson: string | undefined): {
  animation: PreviewAnimation;
  durationSec: number;
  durationInFrames: number;
  fps: number;
} {
  const fps = PREVIEW_FPS;
  let durationSec = DEFAULT_PREVIEW_DURATION_SEC;
  let animation: PreviewAnimation = {
    enter: 1.5,
    hold: Math.max(1, DEFAULT_PREVIEW_DURATION_SEC - 3),
    exit: 1.5,
  };

  try {
    const schema = schemaJson ? JSON.parse(schemaJson) : {};
    const defaults = (schema?.defaults ?? {}) as Record<string, unknown>;
    const props = (schema?.properties ?? {}) as Record<string, { default?: unknown }>;

    const rawDuration =
      (typeof defaults.durationSec === 'number' && defaults.durationSec) ||
      (typeof props.durationSec?.default === 'number' && props.durationSec.default) ||
      null;

    const animDefault = (defaults.animation ?? props.animation?.default) as
      | PreviewAnimation
      | undefined;

    if (
      animDefault &&
      typeof animDefault.enter === 'number' &&
      typeof animDefault.hold === 'number' &&
      typeof animDefault.exit === 'number'
    ) {
      const enter = Math.max(0.05, animDefault.enter);
      const hold = Math.max(0.1, animDefault.hold);
      const exit = Math.max(0.05, animDefault.exit);
      animation = { enter, hold, exit };
      durationSec = enter + hold + exit;
    } else if (typeof rawDuration === 'number' && rawDuration > 0) {
      durationSec = rawDuration;
      const enter = Math.min(2, Math.max(0.4, durationSec * 0.1));
      const exit = Math.min(2, Math.max(0.4, durationSec * 0.1));
      const hold = Math.max(0.5, durationSec - enter - exit);
      animation = { enter, hold, exit };
    }
  } catch {
    /* keep defaults */
  }

  durationSec = Math.min(MAX_PREVIEW_DURATION_SEC, Math.max(MIN_PREVIEW_DURATION_SEC, durationSec));
  const sum = animation.enter + animation.hold + animation.exit;
  // Keep animation props consistent with clamped duration
  if (Math.abs(sum - durationSec) > 0.05) {
    const scale = durationSec / Math.max(0.01, sum);
    animation = {
      enter: Math.max(0.05, animation.enter * scale),
      hold: Math.max(0.1, animation.hold * scale),
      exit: Math.max(0.05, animation.exit * scale),
    };
  }

  return {
    animation,
    durationSec,
    durationInFrames: Math.max(1, Math.round(durationSec * fps)),
    fps,
  };
}

// Cheap hash so we can detect when sceneCode changes (after an editSceneCode call)
// and force a re-bundle. Don't need cryptographic strength — just stable + collision-resistant.
function hashCode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function localSourceHash(plugin: PendingPlugin): string {
  return plugin.sourceHash ?? hashCode(stableStringify({
    sceneCode: plugin.sceneCode ?? '',
    modules: plugin.modules ?? null,
    schemaJson: plugin.schemaJson ?? '',
    dependencies: plugin.dependencies ?? {},
  }));
}

function formatJsonForViewer(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function buildCodeFiles(plugin: PendingPlugin): Record<string, string> {
  const sourceFiles = plugin.modules && Object.keys(plugin.modules).length > 0
    ? plugin.modules
    : { 'Scene.tsx': plugin.sceneCode || '// No code yet - agent is still generating...' };

  return {
    ...sourceFiles,
    'schema.json': formatJsonForViewer(plugin.schemaJson),
    'dependencies.json': formatJsonForViewer(plugin.dependencies ?? {}),
  };
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'plugin';
}

/** Extract preview data from a plugin schema — uses the schema's own defaults.
 *  Image fields with empty src are replaced with a placeholder so Remotion's
 *  <Img> doesn't throw "No src prop". */
function previewDataFromSchema(schemaJson: string, durationSec?: number): Record<string, any> {
  try {
    const schema = JSON.parse(schemaJson);
    const raw: Record<string, any> =
      schema.defaults && typeof schema.defaults === 'object'
        ? { ...schema.defaults }
        : Object.fromEntries(
            Object.entries<any>(schema.properties ?? {})
              .filter(([, v]) => v.default !== undefined)
              .map(([k, v]) => [k, v.default])
          );

    // Replace empty image fields with a placeholder URL
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries<any>(props)) {
      if (v.editor === 'image' && !raw[k]) {
        raw[k] = PLACEHOLDER_IMG;
      }
    }
    // Ensure Scene can read intended length even if animation props differ
    if (typeof durationSec === 'number' && durationSec > 0 && raw.durationSec == null) {
      raw.durationSec = durationSec;
    }
    return raw;
  } catch {
    return durationSec ? { durationSec } : {};
  }
}

// ---------------------------------------------------------------------------
// Host dependency bootstrap (CJS require shim)
//
// preview-bundler emits CommonJS with external react/remotion/three/etc.
// We inject host singletons into globalThis.__pluginDeps and evaluate the
// bundle with new Function('exports','require','module', code) — same path as
// DynamicVideo. No ESM blob import, no regex import rewrites.
// ---------------------------------------------------------------------------

let pluginDepsReady = false;

async function ensurePluginDeps(): Promise<void> {
  if (pluginDepsReady) return;

  const [
    React,
    ReactDOM,
    ReactDOMClient,
    jsxRuntime,
    jsxDevRuntime,
    Remotion,
    RemotionPlayer,
    mediaUtils,
    remotionSfx,
    three,
    r3f,
    drei,
    postfx,
    postprocessing,
    remotionThree,
    remotionLottie,
  ] = await Promise.all([
    import('react'),
    import('react-dom'),
    import('react-dom/client'),
    import('react/jsx-runtime'),
    import('react/jsx-dev-runtime'),
    import('remotion'),
    import('@remotion/player'),
    import('@remotion/media-utils'),
    import('@remotion/sfx'),
    import('three'),
    import('@react-three/fiber'),
    import('@react-three/drei'),
    import('@react-three/postprocessing'),
    import('postprocessing'),
    import('@remotion/three'),
    import('@remotion/lottie'),
  ]);

  const g = globalThis as Record<string, unknown>;
  const deps = (g.__pluginDeps ?? {}) as Record<string, unknown>;
  deps['react'] = React;
  deps['react-dom'] = ReactDOM;
  deps['react-dom/client'] = ReactDOMClient;
  deps['react/jsx-runtime'] = jsxRuntime;
  deps['react/jsx-dev-runtime'] = jsxDevRuntime;
  deps['remotion'] = Remotion;
  deps['@remotion/player'] = RemotionPlayer;
  deps['@remotion/renderer'] = {};
  deps['@remotion/media-utils'] = mediaUtils;
  deps['@remotion/sfx'] = remotionSfx;
  deps['three'] = three;
  deps['@react-three/fiber'] = r3f;
  deps['@react-three/drei'] = drei;
  deps['@react-three/postprocessing'] = postfx;
  deps['postprocessing'] = postprocessing;
  deps['@remotion/three'] = remotionThree;
  deps['@remotion/lottie'] = remotionLottie;
  g.__pluginDeps = deps;
  pluginDepsReady = true;
}

function evaluateCjsPluginBundle(code: string, pluginId: string): Record<string, unknown> {
  const exportsObj: Record<string, unknown> = {};
  const moduleObj = { exports: exportsObj };
  const customRequire = (pkg: string) => {
    const deps = ((globalThis as Record<string, unknown>).__pluginDeps ?? {}) as Record<string, unknown>;
    if (deps[pkg]) return deps[pkg];
    console.warn(`[PluginPreview] "${pluginId}" requested unknown module: ${pkg}`);
    return {};
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function('exports', 'require', 'module', code);
  factory(exportsObj, customRequire, moduleObj);
  return moduleObj.exports as Record<string, unknown>;
}

function pickPluginComponent(mod: Record<string, unknown>): React.ComponentType<any> | null {
  const candidate =
    (mod as any)?.default?.scene ??
    mod?.default ??
    mod?.Scene ??
    mod?.scene ??
    Object.values(mod ?? {}).find((value) => typeof value === 'function');
  return typeof candidate === 'function' ? (candidate as React.ComponentType<any>) : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginPreview() {
  const { pendingPlugin, sendMessage, setPendingPlugin, threadId, isStreaming } = useWizardChatStore();
  const [state, setState] = useState<PreviewState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [feedback, setFeedback] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'sandbox'>('preview');
  const [activeFile, setActiveFile] = useState('Scene.tsx');
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Manual library save (does NOT clear pending / does NOT use agent)
  const [showManualSave, setShowManualSave] = useState(false);
  const [manualSaveName, setManualSaveName] = useState('');
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualSaveError, setManualSaveError] = useState<string | null>(null);
  const [manualSaveErrors, setManualSaveErrors] = useState<string[]>([]);
  const [lastManualSave, setLastManualSave] = useState<{ pluginId: string; name: string } | null>(null);

  // Sandbox tab (additive — agents unchanged)
  const [depsJsonText, setDepsJsonText] = useState('{}');
  const [newFilePath, setNewFilePath] = useState('');
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [sandboxMsg, setSandboxMsg] = useState<string | null>(null);
  const [sandboxErr, setSandboxErr] = useState<string | null>(null);

  // Dedup key for re-bundling: hash of sceneCode (changes on every editSceneCode),
  // not pluginId (stays the same across edits). Prevents stale previews after edits.
  const loadedSceneHash = useRef<string | null>(null);

  // Fetch latest pendingPlugin from server and update the Zustand store.
  // This ensures the reload button always uses server-side job state (which
  // editSceneCode updates), not a stale SSE snapshot.
  const refreshFromServer = useCallback(async (): Promise<PendingPlugin | null> => {
    if (!threadId) return null;
    try {
      const res = await fetch(`/api/mcp/jobs/${encodeURIComponent(threadId)}/state`);
      if (!res.ok) return null;
      const serverState = await res.json();
      const serverPlugin = serverState?.pendingPlugin;
      if (serverPlugin?.sceneCode) {
        setPendingPlugin(serverPlugin);
        return serverPlugin;
      }
    } catch { /* network error — fall back to store */ }
    return null;
  }, [threadId, setPendingPlugin]);

  const loadPreview = useCallback(async (
    sceneCode: string,
    pluginId: string,
    dependencies?: Record<string, string>,
    modules?: Record<string, string>,
    schemaJson?: string,
    expectedSourceHash?: string,
  ) => {
    const sourceHash = expectedSourceHash ?? hashCode(stableStringify({ sceneCode, dependencies, modules, schemaJson }));
    if (loadedSceneHash.current === sourceHash) return;

    setState('loading');
    setErrorMsg('');
    setComponent(null);
    setPreviewMeta(null);

    try {
      const res = await fetch('/api/plugins/preview-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneCode, pluginId, dependencies, modules, schemaJson }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Build failed');
      }

      if (typeof json.bundleJs !== 'string' || !json.bundleJs) {
        throw new Error('Build succeeded but bundleJs was empty');
      }

      // Host singletons for require() — matches DynamicVideo + CJS preview-bundler.
      await ensurePluginDeps();
      const mod = evaluateCjsPluginBundle(json.bundleJs, pluginId);
      const exported = pickPluginComponent(mod);

      if (!exported) {
        throw new Error('Bundle did not export a React component');
      }

      setComponent(() => exported);
      loadedSceneHash.current = json.sourceHash ?? sourceHash;
      setPreviewMeta({
        sourceHash: json.sourceHash ?? sourceHash,
        previewBuildId: json.previewBuildId ?? `${sourceHash}-local`,
        bundleBytes: json.bundleBytes ?? json.bundleJs?.length ?? 0,
      });
      setState('ready');
    } catch (e: any) {
      console.error('[PluginPreview] failed to load preview:', e?.message);
      setErrorMsg(e?.message ?? 'Unknown error');
      setState('error');
    }
  }, []);

  // Runtime preview crashes are shown to the user, but we do not auto-send
  // a follow-up chat message. A delayed auto-heal can fire after Stop / Save
  // and hijack the next user intent with stale crash context.
  const handleRuntimeError = useCallback((error: Error) => {
    if (!pendingPlugin) return;

    // Pull the first Scene.tsx frame from the stack (works thanks to inline source maps).
    const sceneFrame = error.stack?.match(/Scene\.tsx:(\d+):(\d+)/);
    const location = sceneFrame ? `Scene.tsx:${sceneFrame[1]}:${sceneFrame[2]}` : '(unknown line)';
    const firstFrame = error.stack?.split('\n')[1]?.trim() ?? '';

    const details =
      `PREVIEW_CRASHED: ${error.message}\n` +
      `Source hash: ${localSourceHash(pendingPlugin)}\n` +
      `Browser preview hash: ${previewMeta?.sourceHash ?? 'unknown'}\n` +
      `Location: ${location}\n` +
      `Stack (first frame): ${firstFrame}`;

    console.warn('[PluginPreview] preview crashed:', details);
    setErrorMsg(details);
    setState('error');
  }, [pendingPlugin, previewMeta]);

  useEffect(() => {
    if (!pendingPlugin) {
      setState('idle');
      setComponent(null);
      loadedSceneHash.current = null;
      return;
    }
    // Keep deps editor in sync when pending changes
    setDepsJsonText(JSON.stringify(pendingPlugin.dependencies ?? {}, null, 2));
    loadPreview(
      pendingPlugin.sceneCode,
      pendingPlugin.pluginId,
      pendingPlugin.dependencies,
      pendingPlugin.modules,
      pendingPlugin.schemaJson,
      localSourceHash(pendingPlugin),
    );
  }, [pendingPlugin, loadPreview]);

  const callPluginSandbox = useCallback(async (payload: Record<string, unknown>) => {
    if (!threadId) throw new Error('No threadId');
    const res = await fetch('/api/ai/wizard/plugin-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false || json.error) {
      const err = json.error || `Request failed (${res.status})`;
      throw new Error(err);
    }
    return json;
  }, [threadId]);

  const handleSandboxSaveDeps = async () => {
    setSandboxBusy(true);
    setSandboxErr(null);
    setSandboxMsg(null);
    try {
      JSON.parse(depsJsonText); // validate
      const json = await callPluginSandbox({
        action: 'set-dependencies',
        dependenciesJson: depsJsonText,
      });
      if (json.pending) setPendingPlugin(json.pending);
      setSandboxMsg(json.message || 'dependencies.json saved on draft.');
    } catch (e) {
      setSandboxErr(e instanceof Error ? e.message : 'Failed to save dependencies');
    } finally {
      setSandboxBusy(false);
    }
  };

  const handleSandboxInstall = async () => {
    setSandboxBusy(true);
    setSandboxErr(null);
    setSandboxMsg(null);
    try {
      // Persist deps editor first if valid JSON
      try {
        JSON.parse(depsJsonText);
        await callPluginSandbox({
          action: 'set-dependencies',
          dependenciesJson: depsJsonText,
        });
      } catch {
        /* use server pending deps */
      }
      const json = await callPluginSandbox({ action: 'install' });
      if (json.pending) {
        // pending may be summarized without full modules — refresh from server
        const fresh = await refreshFromServer();
        if (!fresh && json.pending.modules) setPendingPlugin(json.pending);
      } else {
        await refreshFromServer();
      }
      loadedSceneHash.current = null;
      const plugin = useWizardChatStore.getState().pendingPlugin;
      if (plugin) {
        await loadPreview(
          plugin.sceneCode,
          plugin.pluginId,
          plugin.dependencies,
          plugin.modules,
          plugin.schemaJson,
          localSourceHash(plugin),
        );
      }
      setSandboxMsg(json.message || `Sandbox install OK (${json.bundleBytes ?? 0} bytes). Preview reloaded.`);
      setActiveTab('preview');
    } catch (e) {
      setSandboxErr(e instanceof Error ? e.message : 'Sandbox install failed');
    } finally {
      setSandboxBusy(false);
    }
  };

  const handleSandboxCreateFile = async () => {
    const path = newFilePath.trim().replace(/\\/g, '/');
    if (!path) return;
    setSandboxBusy(true);
    setSandboxErr(null);
    setSandboxMsg(null);
    try {
      const stub =
        path.endsWith('.tsx') || path.endsWith('.jsx')
          ? `import React from 'react';\n\nexport function Component() {\n  return <div />;\n}\n`
          : path.endsWith('.ts') || path.endsWith('.js')
            ? `export {};\n`
            : path.endsWith('.json')
              ? `{}\n`
              : `/* ${path} */\n`;
      const json = await callPluginSandbox({
        action: 'upsert-file',
        file: path,
        code: stub,
      });
      const fresh = await refreshFromServer();
      if (fresh) {
        setActiveFile(path);
        setActiveTab('code');
      } else if (json.pending) {
        setPendingPlugin(json.pending);
      }
      setNewFilePath('');
      setSandboxMsg(`Created ${path}. Edit it in the Code tab.`);
    } catch (e) {
      setSandboxErr(e instanceof Error ? e.message : 'Failed to create file');
    } finally {
      setSandboxBusy(false);
    }
  };

  if (!pendingPlugin) return null;

  const codeFiles = buildCodeFiles(pendingPlugin);
  const fileNames = Object.keys(codeFiles);
  const selectedFile = codeFiles[activeFile] !== undefined ? activeFile : fileNames[0] ?? 'Scene.tsx';
  const sourceHash = localSourceHash(pendingPlugin);
  const compileCurrent = pendingPlugin.lastCompiledSourceHash === sourceHash && pendingPlugin.lastCompileOk;
  const savedPreviewCurrent = pendingPlugin.previewSourceHash === sourceHash;
  const browserPreviewCurrent = previewMeta?.sourceHash === sourceHash;
  const selectedFileCode = codeFiles[selectedFile] ?? '';
  
  const [overrideDuration, setOverrideDuration] = useState<number | null>(null);
  const basePreviewTiming = previewTimingFromSchema(pendingPlugin.schemaJson);
  const previewTiming = overrideDuration ? {
    ...basePreviewTiming,
    durationSec: overrideDuration,
    durationInFrames: Math.max(1, Math.round(overrideDuration * basePreviewTiming.fps)),
  } : basePreviewTiming;
  
  const previewData = previewDataFromSchema(pendingPlugin.schemaJson, previewTiming.durationSec);

  const copySelectedFile = async () => {
    await navigator.clipboard.writeText(selectedFileCode);
    setCopiedFile(selectedFile);
    window.setTimeout(() => setCopiedFile((current) => (current === selectedFile ? null : current)), 1400);
  };

  const handleSaveEdit = async () => {
    if (!threadId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/ai/wizard/manual-code-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          file: selectedFile,
          code: editedCode,
          action: 'edit'
        })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setIsEditing(false);
      
      // Clear local hash and fetch fresh state from server so preview updates
      loadedSceneHash.current = null;
      const freshPlugin = await refreshFromServer();
      const plugin = freshPlugin ?? pendingPlugin;
      if (plugin) {
        loadPreview(
          plugin.sceneCode,
          plugin.pluginId,
          plugin.dependencies,
          plugin.modules,
          plugin.schemaJson,
          localSourceHash(plugin),
        );
      }
    } catch (e) {
      console.error('Failed to save manual edit:', e);
      alert('Failed to save edit: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const openManualSave = () => {
    setManualSaveName(pendingPlugin?.pluginName?.replace(/^Copy of\s+/i, '') || pendingPlugin?.pluginId || '');
    setManualSaveError(null);
    setManualSaveErrors([]);
    setShowManualSave(true);
  };

  const handleManualSave = async () => {
    if (!threadId || !manualSaveName.trim()) return;
    setIsManualSaving(true);
    setManualSaveError(null);
    setManualSaveErrors([]);
    try {
      const res = await fetch('/api/ai/wizard/save-plugin-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          name: manualSaveName.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false || json.error) {
        const errs = Array.isArray(json.errors) ? json.errors.map(String) : [];
        setManualSaveError(json.error || json.message || `Save failed (${res.status})`);
        setManualSaveErrors(errs);
        return;
      }
      setLastManualSave({ pluginId: json.pluginId, name: json.name || manualSaveName.trim() });
      setShowManualSave(false);
      // Do NOT clear pendingPlugin — draft session continues
    } catch (e) {
      setManualSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setIsManualSaving(false);
    }
  };

  const downloadAllFiles = () => {
    const payload = {
      pluginId: pendingPlugin.pluginId,
      pluginName: pendingPlugin.pluginName,
      sourceHash,
      sourceVersion: {
        lastCompiledSourceHash: pendingPlugin.lastCompiledSourceHash ?? null,
        previewSourceHash: pendingPlugin.previewSourceHash ?? null,
        previewBuildId: pendingPlugin.previewBuildId ?? null,
        browserPreviewSourceHash: previewMeta?.sourceHash ?? null,
      },
      files: codeFiles,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFilename(pendingPlugin.pluginId)}-source-${sourceHash}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#0A0A0F', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Code weight="duotone" size={14} style={{ color: '#A78BFA' }} />
          <span className="text-xs font-semibold" style={{ color: '#E2E2F0' }}>
            Plugin Preview
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            {pendingPlugin.pluginName}
          </span>
          <span
            className="hidden lg:inline-flex text-[10px] px-2 py-0.5 rounded-full font-mono"
            title={`source=${sourceHash}\ncompiled=${pendingPlugin.lastCompiledSourceHash ?? 'none'}\nsaved preview=${pendingPlugin.previewSourceHash ?? 'none'}\nbrowser preview=${previewMeta?.sourceHash ?? 'none'}`}
            style={{
              background: browserPreviewCurrent ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
              color: browserPreviewCurrent ? '#86EFAC' : '#FBBF24',
              border: `1px solid ${browserPreviewCurrent ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
            }}
          >
            {browserPreviewCurrent ? 'preview current' : 'preview stale'} {sourceHash}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Tab switcher */}
          <div
            className="flex rounded-lg p-0.5 gap-0.5"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {(['preview', 'code', 'sandbox'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all capitalize"
                style={{
                  background: activeTab === tab ? 'rgba(124,58,237,0.3)' : 'transparent',
                  color: activeTab === tab ? '#A78BFA' : '#55556A',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              loadedSceneHash.current = null;
              // Fetch latest code from server (agent may have edited via editSceneCode
              // but not called savePendingPlugin yet).
              const freshPlugin = await refreshFromServer();
              const plugin = freshPlugin ?? pendingPlugin;
              loadPreview(
                plugin.sceneCode,
                plugin.pluginId,
                plugin.dependencies,
                plugin.modules,
                plugin.schemaJson,
                localSourceHash(plugin),
              );
            }}
            className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
            title="Reload preview"
          >
            <ArrowsClockwise weight="bold" size={12} style={{ color: '#9B9BBB' }} />
          </button>
        </div>
      </div>

      {/* Pane */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'sandbox' ? (
          <div className="h-full min-h-0 overflow-auto p-4 flex flex-col gap-3">
            <p className="text-[11px] leading-relaxed" style={{ color: '#8B8BAA' }}>
              Remotion plugin sandbox (additive). Edit <code style={{ color: '#C4C4E0' }}>dependencies.json</code>,
              create files, then <strong style={{ color: '#C4C4E0' }}>Install packages</strong> using the{' '}
              <strong style={{ color: '#C4C4E0' }}>same sandbox as preview</strong>. Agent flow is unchanged.
            </p>

            <div className="text-[10px] font-mono" style={{ color: '#6B6B8A' }}>
              Files: {(pendingPlugin.modules ? Object.keys(pendingPlugin.modules) : ['Scene.tsx']).join(', ') || 'Scene.tsx'}
            </div>

            <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6B6B8A' }}>
              dependencies.json
            </label>
            <textarea
              value={depsJsonText}
              onChange={(e) => setDepsJsonText(e.target.value)}
              spellCheck={false}
              rows={8}
              className="w-full text-[11px] font-mono p-3 rounded-xl outline-none resize-y min-h-[120px]"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#E2E2F0',
              }}
              placeholder={'{\n  "maplibre-gl": "^5.0.0"\n}'}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sandboxBusy || !threadId}
                onClick={() => void handleSandboxSaveDeps()}
                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl font-medium disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#C4C4E0',
                }}
              >
                Save dependencies.json
              </button>
              <button
                type="button"
                disabled={sandboxBusy || !threadId}
                onClick={() => void handleSandboxInstall()}
                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl font-semibold disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                  color: '#fff',
                }}
              >
                {sandboxBusy ? (
                  <>
                    <CircleNotch className="animate-spin" size={14} weight="bold" />
                    Sandbox working…
                  </>
                ) : (
                  <>
                    <CloudArrowUp size={14} weight="bold" />
                    Install packages (sandbox)
                  </>
                )}
              </button>
            </div>

            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6B6B8A' }}>
                Create file
              </label>
              <div className="flex gap-2">
                <input
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="features/MapLayers.tsx"
                  className="flex-1 text-[11px] font-mono px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#E2E2F0',
                  }}
                />
                <button
                  type="button"
                  disabled={sandboxBusy || !newFilePath.trim() || !threadId}
                  onClick={() => void handleSandboxCreateFile()}
                  className="text-[11px] px-3 py-2 rounded-lg font-medium disabled:opacity-40"
                  style={{
                    background: 'rgba(124,58,237,0.2)',
                    border: '1px solid rgba(167,139,250,0.3)',
                    color: '#DDD6FE',
                  }}
                >
                  Add file
                </button>
              </div>
              <p className="text-[10px]" style={{ color: '#55556A' }}>
                Then open the Code tab to edit. Install after changing dependencies.
              </p>
            </div>

            {sandboxMsg && (
              <div
                className="text-[11px] px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  color: '#86EFAC',
                }}
              >
                {sandboxMsg}
              </div>
            )}
            {sandboxErr && (
              <div
                className="text-[11px] px-3 py-2 rounded-lg whitespace-pre-wrap font-mono max-h-40 overflow-auto"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#FCA5A5',
                }}
              >
                {sandboxErr}
                <button
                  type="button"
                  className="block mt-2 text-[10px] underline"
                  onClick={() => {
                    sendMessage(
                      `Plugin sandbox install/build failed. Fix dependencies.json or source only. Do NOT call build-and-save-plugin.\n\n${sandboxErr}`,
                    );
                  }}
                >
                  Send error to agent
                </button>
              </div>
            )}
          </div>
        ) : activeTab === 'code' ? (
          /* ── Code viewer ── */
          <div className="h-full min-h-0 flex flex-col">
            <div
              className="shrink-0 px-3 py-2 flex items-center justify-between gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 overflow-x-auto min-w-0">
                {fileNames.map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => {
                      setActiveFile(fileName);
                      setIsEditing(false);
                    }}
                    className="text-[10px] px-2.5 py-1 rounded-md font-mono whitespace-nowrap transition-all"
                    style={{
                      background: selectedFile === fileName ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
                      color: selectedFile === fileName ? '#DDD6FE' : '#8B8BAA',
                      border: `1px solid ${selectedFile === fileName ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {fileName}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isEditing ? (
                  <button
                    onClick={() => {
                      setEditedCode(selectedFileCode);
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: '#C4C4E0',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                    title="Edit file manually"
                  >
                    <PencilSimple size={12} weight="bold" />
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md transition-all disabled:opacity-50"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        color: '#FCA5A5',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md transition-all disabled:opacity-50"
                      style={{
                        background: 'rgba(34,197,94,0.15)',
                        color: '#86EFAC',
                        border: '1px solid rgba(34,197,94,0.3)',
                      }}
                    >
                      {isSaving ? <CircleNotch className="animate-spin" size={12} /> : <FloppyDisk size={12} weight="bold" />}
                      Save
                    </button>
                  </>
                )}
                <button
                  onClick={copySelectedFile}
                  className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: copiedFile === selectedFile ? '#86EFAC' : '#C4C4E0',
                    border: `1px solid ${copiedFile === selectedFile ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                  title={`Copy ${selectedFile}`}
                >
                  <Copy size={12} weight="bold" />
                  {copiedFile === selectedFile ? 'Copied' : 'Copy file'}
                </button>
                <button
                  onClick={downloadAllFiles}
                  className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md transition-all"
                  style={{
                    background: 'rgba(124,58,237,0.14)',
                    color: '#DDD6FE',
                    border: '1px solid rgba(167,139,250,0.26)',
                  }}
                  title="Download all plugin source files"
                >
                  <DownloadSimple size={12} weight="bold" />
                  Download all
                </button>
              </div>
            </div>
            <div
              className="shrink-0 px-3 py-2 grid grid-cols-2 gap-2 text-[10px] font-mono"
              style={{ color: '#8B8BAA', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>source: <span style={{ color: '#C4C4E0' }}>{sourceHash}</span></div>
              <div>compiled: <span style={{ color: compileCurrent ? '#86EFAC' : '#FBBF24' }}>{pendingPlugin.lastCompiledSourceHash ?? 'none'}</span></div>
              <div>saved preview: <span style={{ color: savedPreviewCurrent ? '#86EFAC' : '#FBBF24' }}>{pendingPlugin.previewSourceHash ?? 'none'}</span></div>
              <div>browser blob: <span style={{ color: browserPreviewCurrent ? '#86EFAC' : '#FBBF24' }}>{previewMeta?.sourceHash ?? 'none'}</span></div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 relative">
              {isEditing ? (
                <div className="h-full w-full rounded-md overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Editor
                    height="100%"
                    language={selectedFile.endsWith('.json') ? 'json' : 'typescript'}
                    theme="vs-dark"
                    value={editedCode}
                    onChange={(val) => setEditedCode(val ?? '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 12 },
                    }}
                  />
                </div>
              ) : (
                <pre
                  className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all"
                  style={{ color: '#C4C4E0' }}
                >
                  {selectedFileCode}
                </pre>
              )}
            </div>
          </div>
        ) : (
          /* ── Preview ── */
          <div className="flex items-center justify-center p-4 h-full">
            {state === 'loading' && (
              <div className="flex flex-col items-center gap-3">
                <CircleNotch weight="bold" size={24} className="animate-spin" style={{ color: '#7C3AED' }} />
                <p className="text-xs" style={{ color: '#55556A' }}>Transpiling scene code…</p>
              </div>
            )}

            {state === 'error' && (
              <div
                className="flex flex-col items-center gap-3 p-4 rounded-xl text-center max-w-xs"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
              >
                <XCircle weight="fill" size={24} style={{ color: '#F87171' }} />
                <p className="text-xs font-medium" style={{ color: '#F87171' }}>Build error</p>
                <p className="text-[11px] font-mono break-all" style={{ color: '#9B9BBB' }}>{errorMsg}</p>
                <button
                  onClick={() => sendMessage(`The plugin preview failed with this error:\n${errorMsg}\n\nPlease inspect the current pending plugin source and modules, then fix only the real cause. Do not assume this is data.animation unless the source actually contains that pattern.`)}
                  disabled={isStreaming}
                  className="mt-1 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  Ask agent to fix
                </button>
              </div>
            )}

            {state === 'ready' && Component && (
              <div
                className="rounded-xl overflow-hidden w-full relative"
                style={{ border: '1px solid rgba(124,58,237,0.3)', aspectRatio: '16/9' }}
              >
                <div
                  className="absolute top-2 right-2 z-10 flex items-center gap-2"
                >
                  <input
                    type="range"
                    min="3"
                    max="120"
                    value={overrideDuration ?? basePreviewTiming.durationSec}
                    onChange={(e) => setOverrideDuration(Number(e.target.value))}
                    className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: '#A78BFA' }}
                    title="Drag to override preview duration"
                  />
                  <div
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md cursor-pointer hover:bg-white/10"
                    style={{
                      background: 'rgba(0,0,0,0.55)',
                      color: '#A78BFA',
                      border: '1px solid rgba(167,139,250,0.25)',
                    }}
                    title="Click to reset duration to schema default"
                    onClick={() => setOverrideDuration(null)}
                  >
                    {previewTiming.durationSec.toFixed(1)}s / {previewTiming.durationInFrames}f @{previewTiming.fps}
                  </div>
                </div>
                <Player
                  component={Component}
                  inputProps={{
                    data: previewData,
                    theme: 'dark_modern',
                    animation: previewTiming.animation,
                    motionProfile: 'dynamic',
                  }}
                  durationInFrames={previewTiming.durationInFrames}
                  compositionWidth={1920}
                  compositionHeight={1080}
                  fps={previewTiming.fps}
                  style={{ width: '100%', height: '100%' }}
                  controls
                  errorFallback={({ error }) => {
                    handleRuntimeError(error);
                    return (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 12,
                          padding: 24,
                          background: 'rgba(239,68,68,0.06)',
                          color: '#F87171',
                          fontSize: 12,
                          textAlign: 'center',
                        }}
                      >
                        <XCircle weight="fill" size={20} />
                        <p style={{ fontWeight: 600 }}>Preview crashed</p>
                        <p style={{ fontSize: 10, color: '#9B9BBB', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {error.message}
                        </p>
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval bar */}
      <div
        className="shrink-0 px-4 pb-4 pt-2 flex flex-col gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {lastManualSave && (
          <div
            className="text-[10px] px-3 py-2 rounded-lg font-mono"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: '#86EFAC',
            }}
          >
            Saved to library as <strong>{lastManualSave.name}</strong>
            {' '}({lastManualSave.pluginId}) — draft preview kept open for more edits.
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setPendingPlugin(null);
              sendMessage(`The plugin preview looks good. Please build and save it.`);
            }}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold flex-1 justify-center transition-all"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              color: '#fff',
              boxShadow: '0 0 14px rgba(124,58,237,0.3)',
            }}
          >
            <CheckCircle weight="fill" size={14} />
            Looks good — save it
          </button>
          <button
            onClick={openManualSave}
            disabled={isStreaming || isManualSaving || !threadId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.3)',
              color: '#7DD3FC',
            }}
            title="Save a copy to the library without AI. Keeps this draft open."
          >
            <CloudArrowUp weight="bold" size={14} />
            Save manually
          </button>
          <button
            onClick={() => setPendingPlugin(null)}
            className="px-3 py-2 rounded-xl text-xs transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#55556A',
            }}
            title="Dismiss preview"
          >
            <XCircle weight="fill" size={14} />
          </button>
        </div>

        {/* Manual save modal */}
        {showManualSave && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => !isManualSaving && setShowManualSave(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
              style={{
                background: '#12121A',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <CloudArrowUp weight="duotone" size={18} style={{ color: '#7DD3FC' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#E2E2F0' }}>
                  Save plugin manually
                </h3>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#8B8BAA' }}>
                Creates a <strong style={{ color: '#C4C4E0' }}>new library plugin</strong> (remix-style id)
                from this draft. No AI. Does <strong style={{ color: '#C4C4E0' }}>not</strong> close the
                preview — you can keep editing. Agent “Looks good — save it” still works as before.
              </p>
              <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#6B6B8A' }}>
                Display name
              </label>
              <input
                value={manualSaveName}
                onChange={(e) => setManualSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualSaveName.trim() && !isManualSaving) {
                    void handleManualSave();
                  }
                }}
                placeholder="e.g. Neon Pipeline"
                autoFocus
                disabled={isManualSaving}
                className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F1F1F8',
                }}
              />
              {manualSaveError && (
                <div
                  className="text-[11px] px-3 py-2 rounded-lg max-h-32 overflow-auto"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#FCA5A5',
                  }}
                >
                  <p className="font-medium">{manualSaveError}</p>
                  {manualSaveErrors.length > 0 && (
                    <ul className="mt-1 font-mono text-[10px] space-y-0.5 opacity-90">
                      {manualSaveErrors.slice(0, 8).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-[10px] underline opacity-90"
                    onClick={() => {
                      const detail = [manualSaveError, ...manualSaveErrors].join('\n');
                      sendMessage(
                        `Final library save failed (manual save). Fix only these build errors, then stop. Do NOT call build-and-save-plugin — I will save manually again.\n\n${detail}`,
                      );
                      setShowManualSave(false);
                    }}
                  >
                    Send errors to agent to fix
                  </button>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={isManualSaving}
                  onClick={() => setShowManualSave(false)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#9B9BBB',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isManualSaving || !manualSaveName.trim() || !threadId}
                  onClick={() => void handleManualSave()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                    color: '#fff',
                  }}
                >
                  {isManualSaving ? (
                    <>
                      <CircleNotch className="animate-spin" size={14} weight="bold" />
                      Building…
                    </>
                  ) : (
                    <>
                      <CloudArrowUp size={14} weight="bold" />
                      Save to library
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback input */}
        <div className="flex gap-2">
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && feedback.trim()) {
                sendMessage(feedback.trim());
                setFeedback('');
              }
            }}
            placeholder="Or describe what to change…"
            className="flex-1 bg-transparent text-xs outline-none px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E2E2F0',
            }}
          />
          <button
            onClick={() => {
              if (!feedback.trim()) return;
              sendMessage(feedback.trim());
              setFeedback('');
            }}
            disabled={!feedback.trim()}
            className="px-3 py-2 rounded-xl text-xs disabled:opacity-30 transition-all"
            style={{
              background: feedback.trim() ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(124,58,237,0.25)',
              color: '#A78BFA',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
