# Production Deploy Runbook

This project is split across two production runtimes:

- **Next.js on Vercel**: UI, auth, normal Next API routes, plugin browser preview route.
- **Mastra on VPS**: long-running wizard/agent backend, Redis run events, Mastra custom routes.

Use this runbook whenever code changes need to go live.

## 1. Decide What Must Be Deployed

Deploy **Vercel only** when changes touch:

- `src/components/**`
- `src/store/**`
- `src/app/**` routes that still run in Next.js
- plugin browser preview route: `src/app/api/plugins/preview-bundle/**`
- frontend/UI state bugs

Deploy **VPS Mastra only** when changes touch:

- `mastra-server/**`
- `src/lib/video/ai/mastra/**`
- shared agent tools used by Mastra
- standalone routes under `mastra-server/src/routes/**`
- Redis run event code under `mastra-server/src/lib/run-events.ts`

Deploy **both** when shared plugin/build code is used by both sides:

- `src/lib/plugins/**`
- plugin build/sandbox code
- shared wizard/plugin state contracts

## 2. Required Local Checks

From the repo root:

```powershell
git status --short
```

For focused TypeScript/bundling checks, run only what changed. Examples:

```powershell
npx esbuild src\lib\plugins\sandbox-builder.ts --bundle --platform=node --format=esm --outfile=$env:TEMP\sandbox-builder-check.mjs
npx esbuild src\components\chat\PluginPreview.tsx --bundle --platform=browser --format=esm --outfile=$env:TEMP\plugin-preview-check.mjs --external:react --external:react-dom --external:@remotion/player --external:@/store/wizard-chat-store --external:@phosphor-icons/react
```

After code changes, update the graph:

```powershell
graphify update .
```

## 3. Deploy Next.js to Vercel

Use this for frontend and Next API changes:

```powershell
vercel --prod --yes
```

Successful output should show:

```text
Production: https://...
Aliased: https://skygen.salru.in
```

Smoke check an authenticated route from the browser. For unauthenticated endpoint checks, `401` is often expected:

```powershell
Invoke-WebRequest -Uri "https://skygen.salru.in/api/plugins/preview-bundle" -Method POST -ContentType "application/json" -Body "{}"
```

If it returns `401 Unauthorized`, the route is deployed and auth is working.

## 4. Build Mastra Locally

From repo root:

```powershell
cd mastra-server
npm run build
cd ..
```

Successful output should include:

```text
Build successful, you can now deploy the .mastra/output directory
```

## 5. Deploy Mastra to VPS

The VPS helper is:

```text
mastra-server\vps.py
```

Set the SSH password in the current shell. Do not write secrets into docs or git:

```powershell
$env:VPS_SSH_PW='<VPS_PASSWORD>'
```

### Fast Deploy: Source Changed, Dependencies Did Not

Use this when package dependencies did not change. It uploads built Mastra files but skips `node_modules`.

```powershell
tar -czf $env:TEMP\mastra-output-no-node-modules.tgz -C mastra-server\.mastra\output --exclude=node_modules .
python mastra-server\vps.py --file $env:TEMP\mastra-output-no-node-modules.tgz mastra-output-no-node-modules.tgz
python mastra-server\vps.py "cd /opt/videogen-mastra/mastra-server/.mastra && cp -a output output.prev.$(date +%Y%m%d%H%M%S) && tar -xzf /root/mastra-output-no-node-modules.tgz -C output && pm2 restart videogen-mastra --update-env && pm2 status videogen-mastra"
```

### Full Deploy: Dependencies Changed

Use this when `mastra-server/package.json`, `mastra-server/package-lock.json`, or runtime dependencies changed.

```powershell
tar -czf $env:TEMP\mastra-output-no-node-modules.tgz -C mastra-server\.mastra\output --exclude=node_modules .
python mastra-server\vps.py --file $env:TEMP\mastra-output-no-node-modules.tgz mastra-output-no-node-modules.tgz
python mastra-server\vps.py "cd /opt/videogen-mastra/mastra-server/.mastra && cp -a output output.prev.$(date +%Y%m%d%H%M%S) && tar -xzf /root/mastra-output-no-node-modules.tgz -C output && cd output && npm install --omit=dev --legacy-peer-deps && pm2 restart videogen-mastra --update-env && pm2 status videogen-mastra"
```

If the VPS has low RAM, prefer the fast deploy when possible.

## 6. VPS Health Checks

```powershell
$env:VPS_SSH_PW='<VPS_PASSWORD>'
python mastra-server\vps.py "pm2 status videogen-mastra && pm2 logs videogen-mastra --lines 40 --nostream && free -h"
```

Expected:

- PM2 process `videogen-mastra` is `online`.
- RAM has enough available memory.
- No repeated crash loop in logs.

Check Mastra auth behavior:

```powershell
Invoke-WebRequest -Uri "https://mastra.salru.in/wizard/threads" -Method GET
```

Unauthenticated requests should normally return `401`, not `502` or connection errors.

## 7. Redis Checks

Redis is used for run event replay/SSE continuity. Mastra reads `REDIS_URL`; if missing, it defaults to:

```text
redis://127.0.0.1:6379
```

Check Redis on VPS:

```powershell
python mastra-server\vps.py "redis-cli ping"
```

Expected:

```text
PONG
```

Check Redis memory:

```powershell
python mastra-server\vps.py "redis-cli info memory | head -20"
```

If Redis is down, the frontend may still connect to SSE, but reconnect/replay behavior can break.

## 8. Environment Variables

Keep these in both places when needed.

Vercel project env:

- `DATABASE_URL`
- `AUTH_SECRET`
- `MASTRA_SERVER_URL`
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID`
- `USE_SANDBOX_BUILDER=true`
- `ALLOW_LOCAL_PLUGIN_BUILD=false`

VPS Mastra env:

- `DATABASE_URL`
- `AUTH_SECRET`
- `REDIS_URL`
- `NEXT_PUBLIC_APP_URL=https://skygen.salru.in`
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID`
- `USE_SANDBOX_BUILDER=true`
- `ALLOW_LOCAL_PLUGIN_BUILD=false`

Do not commit real values.

Vercel env list:

```powershell
vercel env ls
```

VPS env file location:

```text
/opt/videogen-mastra/mastra-server/.env
```

After changing VPS env:

```powershell
python mastra-server\vps.py "pm2 restart videogen-mastra --update-env"
```

## 9. Common Failures

### Plugin preview says missing Vercel credentials

The failing side is whichever route is doing the sandbox call.

- Browser preview route: deploy/fix Vercel env.
- Agent final plugin build: fix VPS env and restart PM2.

Required env:

```text
VERCEL_TOKEN
VERCEL_TEAM_ID
VERCEL_PROJECT_ID
```

### Plugin preview works but final save fails on `Could not resolve "./theme"`

Preview and final build are out of sync. Final build must receive the same `modules` map as preview. Do not ask the agent to inline files as a permanent solution.

### `Cannot read properties of undefined (reading 'enter')`

This is usually a browser preview runtime error, not a server compile error.

The host preview must pass:

```ts
inputProps={{
  data,
  theme: 'dark_modern',
  animation: { enter: 0.4, hold: 4.2, exit: 0.4 },
  motionProfile: 'dynamic',
}}
```

Mastra/VPS does not know browser runtime errors unless the frontend sends them.

### Vercel deploy blocked by git email

Set git email to the GitHub account email, then push a new commit:

```powershell
git config --global user.email "your-github-email@example.com"
```

### `ERR_CONTENT_DECODING_FAILED`

Usually proxy/compression mismatch. Check Next proxy route and upstream response headers. Also check nginx if the failing route goes through VPS.

### PM2 online but app still old

Verify the deployed bundle contains your new code:

```powershell
python mastra-server\vps.py "grep -R \"some-new-code-string\" -n /opt/videogen-mastra/mastra-server/.mastra/output/*.mjs"
```

Then restart:

```powershell
python mastra-server\vps.py "pm2 restart videogen-mastra --update-env"
```

## 10. Rollback

The deploy command creates backups like:

```text
/opt/videogen-mastra/mastra-server/.mastra/output.prev.YYYYMMDDHHMMSS
```

Rollback example:

```powershell
python mastra-server\vps.py "cd /opt/videogen-mastra/mastra-server/.mastra && mv output output.bad.$(date +%Y%m%d%H%M%S) && cp -a output.prev.YYYYMMDDHHMMSS output && pm2 restart videogen-mastra --update-env"
```

For Vercel, rollback from the Vercel dashboard or redeploy a known-good commit.

## 11. Deployment Rule Of Thumb

- UI bug: deploy Vercel.
- Agent/tool bug: deploy VPS Mastra.
- Plugin sandbox/build bug: usually deploy both.
- Env bug: update the runtime that produced the error, then restart/redeploy that runtime.
- Redis/SSE bug: check VPS Redis, PM2 logs, and `/api/ai/wizard/runs/:runId/events`.
