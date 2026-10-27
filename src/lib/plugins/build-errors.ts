export type PluginBuildStage = 'setup' | 'install' | 'build' | 'compatibility';

export interface PluginBuildFailure {
  stage: PluginBuildStage;
  message: string;
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export function formatPluginBuildFailure(failure: PluginBuildFailure): string {
  const lines = [failure.message];
  if (failure.command) lines.push(`Command: ${failure.command}`);
  if (failure.exitCode !== undefined) lines.push(`Exit code: ${failure.exitCode}`);
  if (failure.stdout) lines.push(`\nstdout:\n${failure.stdout}`);
  if (failure.stderr) lines.push(`\nstderr:\n${failure.stderr}`);
  return lines.join('\n');
}

export class PluginBuildError extends Error {
  constructor(public readonly failure: PluginBuildFailure) {
    super(formatPluginBuildFailure(failure));
    this.name = 'PluginBuildError';
  }
}

export function pluginBuildFailure(error: unknown, stage: PluginBuildStage = 'build', command?: string): PluginBuildFailure {
  if (error instanceof PluginBuildError) return error.failure;
  const detail = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
  return {
    stage,
    message: typeof detail.message === 'string' ? detail.message : String(error ?? 'Plugin build failed'),
    command,
    exitCode: typeof detail.exitCode === 'number' ? detail.exitCode : undefined,
    stdout: typeof detail.stdout === 'string' ? detail.stdout : undefined,
    stderr: typeof detail.stderr === 'string' ? detail.stderr : undefined,
  };
}

interface BuildCommandResult { exitCode: number; stdout: string; stderr: string; error?: unknown }

/** E2B may return a failure OR throw CommandExitError with the logs attached. */
export async function runPluginBuildCommand(
  run: (command: string) => Promise<BuildCommandResult>,
  command: string,
  stage: 'install' | 'build',
): Promise<BuildCommandResult> {
  try {
    const result = await run(command);
    if (result.error || result.exitCode !== 0) {
      throw new PluginBuildError({
        stage, command, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr,
        message: stage === 'install' ? 'Dependency installation failed.' : 'Plugin compilation failed.',
      });
    }
    return result;
  } catch (error) {
    throw new PluginBuildError(pluginBuildFailure(error, stage, command));
  }
}
