# Task: Fix 6 issues in videoGen Mastra migration

## Agent: Main
## Task ID: mastra-migration-fix

### Issues Fixed

1. **Issue 3** - Removed dead exports (lines 3116-3151) from bottom of `graph.ts`. These exported internal functions that were never imported by any Mastra tool.

2. **Issue 4** - Removed duplicate `WizardNarrativeBrief` from `mastra/shared/types.ts`. Updated references:
   - `mastra/shared/types.ts`: Deleted `WizardNarrativeBrief` interface
   - `ai/index.ts`: Changed export from `WizardNarrativeBrief` to `NarrativeBrief`
   - `components/editor/TemplateGallery.tsx`: Updated import and usage to `NarrativeBrief`

3. **Issue 5** - Applied user audio overrides in `review_audio` phase of `wizard.workflow.ts`. Added code to apply `value.audioOverrides` mapping before calling `applyBlockPostProcessors`.

4. **Issue 6** - Fixed `@vercel/sandbox` API mismatches in `sandbox-builder.ts`:
   - `Sandbox.create({ label })` → `Sandbox.create({ timeout: 60_000 })`
   - `sandbox.writeFile(path, content)` → `sandbox.writeFiles([{ path, content }])`
   - `sandbox.makeDir(path)` → `sandbox.mkDir(path)`
   - `sandbox.runCommand('node', args, { timeout })` → `sandbox.runCommand('node', args)`

5. **Issue 1+2** - Rewrote Mastra workflows with actual Workflow/Step/Agent + token tracking:
   - `shared/utils.ts`: Added `callAIWithTracking`, `withTokenTracking`, `getTokenTotal`, `resetTokenTracker` using `AsyncLocalStorage`
   - `agents/director.agent.ts`: Created Mastra Agent registered in the instance
   - `workflows/video-gen.workflow.ts`: Rewrote with `createWorkflow`/`createStep` chaining + `commit()`
   - `workflows/wizard.workflow.ts`: Rewrote with `createWorkflow`/`createStep` with `suspend`/`resumeSchema` + `commit()`
   - `mastra/index.ts`: Created `Mastra` instance registering workflows and agents
   - `ai/index.ts`: Updated to re-export `mastra`, `callAIWithTracking`, workflow instances
