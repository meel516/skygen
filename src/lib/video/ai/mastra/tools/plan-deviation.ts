import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { patchJobState, getJob } from '@/lib/mcp/wizard-jobs';

// ============================================================================
// PLAN DEVIATION — make reasoning visible and auditable
//
// Pure ReAct hides reasoning inside tool-call chains. Reason+Act requires the
// agent to commit a hypothesis before acting, and explicitly record when the
// hypothesis was wrong. This tool persists those deviations so:
//
//   1. The orchestrator has a clear "what did we try, what failed" log
//   2. After many builds, you have a dataset of common failure modes per
//      domain — feed back as few-shot examples in the planner prompt
//   3. The agent can detect repeated deviations on the same step → escalate
//      to global replan instead of looping
// ============================================================================

export interface PlanDeviation {
  stepId: string;
  /** What the agent expected to happen if the hypothesis was correct */
  expected: string;
  /** What actually happened (compile error, blank preview, guard failure, etc.) */
  actual: string;
  /** Why the hypothesis was wrong */
  reason: string;
  /** How the plan adapts */
  resolution: 'local_repair' | 'global_replan' | 'abort' | 'continue';
  /** Next step the orchestrator will route to (null if aborting) */
  nextStepId?: string | null;
  recordedAt: string;
}

// ─── Tool: recordPlanDeviation ──────────────────────────────────────────────

export const recordPlanDeviationTool = createTool({
  id: 'record-plan-deviation',
  description:
    'Record that a step\'s hypothesis did NOT hold, and how the plan is adapting. ' +
    'Call this BEFORE routing a repair step or replanning. The deviation ledger is the system\'s audit trail — repeated deviations on the same step signal that a global replan is needed instead of another local repair. ' +
    'Do NOT skip this even if the fix is obvious — the audit trail matters more than the saved token.',
  inputSchema: z.object({
    threadId: z.string(),
    stepId: z.string(),
    expected: z.string().describe('What you expected to happen, e.g. "compilePreview would pass because the only change was a color value"'),
    actual: z.string().describe('What actually happened, e.g. "compilePreview failed: data.animation is reserved at Scene.tsx:42"'),
    reason: z.string().describe('Why the hypothesis was wrong, e.g. "I assumed the coder would use props.animation, but it read data.animation instead"'),
    resolution: z.enum(['local_repair', 'global_replan', 'abort', 'continue']).describe('How the plan adapts'),
    nextStepId: z.string().nullable().optional().describe('Next step id the orchestrator will route to. Null if aborting.'),
  }),
  execute: async (inputData) => {
    const { threadId, stepId, expected, actual, reason, resolution, nextStepId } = inputData;
    const deviation: PlanDeviation = {
      stepId,
      expected,
      actual,
      reason,
      resolution,
      nextStepId: nextStepId ?? null,
      recordedAt: new Date().toISOString(),
    };

    let deviationCount = 0;
    let updatedExecution: any = null;

    await patchJobState(threadId, (state: any) => {
      const existingExecution = state.pluginExecution ?? state.pendingPlugin?.runLedger?.execution;
      if (!existingExecution) return state;

      // Append to execution.deviations (new field)
      const deviations: PlanDeviation[] = [...(existingExecution.deviations ?? []), deviation];
      deviationCount = deviations.filter((d) => d.stepId === stepId).length;
      updatedExecution = { ...existingExecution, deviations, updatedAt: new Date().toISOString() };

      // Mirror into ledger events for visibility
      let pendingPlugin = state.pendingPlugin;
      if (pendingPlugin?.runLedger) {
        const now = new Date().toISOString();
        pendingPlugin = {
          ...pendingPlugin,
          runLedger: {
            ...pendingPlugin.runLedger,
            execution: updatedExecution,
            events: [
              ...pendingPlugin.runLedger.events.slice(-24),
              {
                type: 'feedback' as const,
                summary: `Deviation on ${stepId} (#${deviationCount} for this step): ${reason}. Resolution: ${resolution}${nextStepId ? ` → ${nextStepId}` : ''}.`,
                errors: [actual],
                at: now,
              },
            ],
            updatedAt: now,
          },
        };
      }

      return { ...state, pluginExecution: updatedExecution, pendingPlugin };
    });

    return {
      ok: true as const,
      deviation,
      deviationCountForStep: deviationCount,
      hint: deviationCount >= 3
        ? `Step ${stepId} has deviated ${deviationCount} times. Consider global replan instead of another local repair.`
        : undefined,
    };
  },
});

// ─── Helper: read deviations for the current run (used by orchestrator + tests) ─

export async function getDeviationsForThread(threadId: string): Promise<PlanDeviation[]> {
  const job = await getJob(threadId);
  const execution = (job?.state as any)?.pluginExecution ?? (job?.state as any)?.pendingPlugin?.runLedger?.execution;
  return execution?.deviations ?? [];
}

export async function getDeviationsForStep(threadId: string, stepId: string): Promise<PlanDeviation[]> {
  const all = await getDeviationsForThread(threadId);
  return all.filter((d) => d.stepId === stepId);
}
