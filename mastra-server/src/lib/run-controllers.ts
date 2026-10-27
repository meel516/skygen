// Process-local registry of AbortControllers for in-flight wizard runs.
// Keyed by runId. The chat handler registers a controller when it kicks off
// runAgentInBackground; the /runs/:runId/cancel route calls abortRun() to
// halt the agent loop between tool calls.
//
// Process-local (not Redis) on purpose — the controller MUST be fired in the
// same process that owns the agent loop. pm2 runs a single fork, so this is
// sufficient. If we ever scale to cluster mode, this needs to move to a
// pub/sub channel where the owning process subscribes to its own runIds.

const controllers = new Map<string, AbortController>();

export function registerRunController(runId: string): AbortController {
  const existing = controllers.get(runId);
  if (existing) return existing;
  const controller = new AbortController();
  controllers.set(runId, controller);
  return controller;
}

export function getRunController(runId: string): AbortController | undefined {
  return controllers.get(runId);
}

export function abortRun(runId: string): boolean {
  const controller = controllers.get(runId);
  if (!controller) return false;
  try {
    controller.abort();
  } catch {
    /* ignore */
  }
  controllers.delete(runId);
  return true;
}

export function clearRunController(runId: string): void {
  controllers.delete(runId);
}
