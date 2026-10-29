import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';

interface PluginSourceState {
  sceneCode?: string;
  modules?: Record<string, string> | null;
}

/** Module source is authoritative even when Scene.tsx is the only file. */
export function getPluginSourceFiles(pending: PluginSourceState): Record<string, string> {
  return pending.modules && Object.keys(pending.modules).length > 0
    ? pending.modules
    : { 'Scene.tsx': pending.sceneCode ?? '' };
}

/** Keep the legacy sceneCode field synchronized with the module entry point. */
export function withPluginSourceFiles<T extends PluginSourceState>(pending: T, modules: Record<string, string>) {
  return { ...pending, modules, sceneCode: modules['Scene.tsx'] ?? '' };
}

/** An edit is successful only if a fresh state read contains the edited source. */
export async function persistPluginSourceEdit(threadId: string, next: Record<string, any>): Promise<boolean> {
  await patchJobState(threadId, state => ({ ...state, pendingPlugin: next }));
  const saved = (await getJob(threadId))?.state?.pendingPlugin;
  if (!saved || saved.pluginId !== next.pluginId || saved.sceneCode !== next.sceneCode) return false;
  const expectedFiles = getPluginSourceFiles(next);
  const savedFiles = getPluginSourceFiles(saved);
  return Object.keys(expectedFiles).length === Object.keys(savedFiles).length
    && Object.entries(expectedFiles).every(([file, code]) => savedFiles[file] === code);
}
