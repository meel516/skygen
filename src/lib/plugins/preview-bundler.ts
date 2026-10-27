import { buildPluginInSandbox, normalizePluginModules } from './sandbox-builder';
import { formatPluginSourceIssues, validatePluginSource } from './source-validation';
import { formatPluginBuildFailure, pluginBuildFailure, type PluginBuildFailure } from './build-errors';

export interface PreviewBundleResult { ok: true; bundleJs: string }
export interface PreviewBundleDiagnostic {
  text: string;
  file: string;
  line: number;
  column: number;
  lineText?: string;
}
export interface PreviewBundleError {
  ok: false;
  error: string;
  buildError?: PluginBuildFailure;
  diagnostics?: PreviewBundleDiagnostic[];
}
export type PreviewBundleOutcome = PreviewBundleResult | PreviewBundleError;
interface PreviewBundleOptions { dependencies?: Record<string, string>; modules?: Record<string, string> }

/** Preview and saved plugins use the same installer, externals and compiler. */
export async function bundlePreview(sceneCode: string, pluginId: string, options: PreviewBundleOptions = {}): Promise<PreviewBundleOutcome> {
  const modules = normalizePluginModules(sceneCode, options.modules);
  const sourceCheck = validatePluginSource(modules);
  if (!sourceCheck.ok) {
    return {
      ok: false,
      error: `Plugin source failed validation:\n${formatPluginSourceIssues(sourceCheck.issues)}`,
      diagnostics: sourceCheck.issues.map(issue => ({ text: issue.message, file: issue.file, line: issue.line, column: 0 })),
    };
  }
  try {
    const result = await buildPluginInSandbox({ pluginId, sceneCode, schemaJson: '{}', modules, dependencies: options.dependencies });
    return { ok: true, bundleJs: result.bundleContent };
  } catch (error: any) {
    const buildError = pluginBuildFailure(error);
    return {
      ok: false,
      error: formatPluginBuildFailure(buildError),
      buildError,
      diagnostics: error?.errors?.map((item: any) => ({
        text: item.text ?? 'Build failed', file: item.location?.file ?? 'Scene.tsx',
        line: item.location?.line ?? 0, column: item.location?.column ?? 0, lineText: item.location?.lineText,
      })),
    };
  }
}
