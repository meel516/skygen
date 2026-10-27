# Mastra VPS + Vercel Deployment Runbook

This project runs as two production services:

- Next.js frontend/API routes on Vercel.
- Standalone Mastra server on the Ubuntu VPS.

The frontend stays on Vercel. The VPS only runs the Mastra backend, PM2, and nginx. Both services use the same production Postgres database and the same Auth.js secret so the Mastra server can read the forwarded session cookie.

## Production Shape

```text
Browser
  |
  | https://skygen.salru.in
  v
Vercel Next.js app
  |
  | wizard AI routes proxy to
  v
https://mastra.skygen.salru.in
  |
  v
nginx on VPS
  |
  v
Mastra standalone server on localhost:4111
  |
  v
Postgres
```

The important rule: do not deploy the Next.js app to the VPS. Vercel owns the web app. The VPS owns Mastra only.

## Required DNS

Create an A or AAAA record for the Mastra backend:

```text
mastra.skygen.salru.in -> VPS public IP
```

Keep the main app domain pointed at Vercel:

```text
skygen.salru.in -> Vercel
```

## Required Environment Variables

Set equivalent production values in both places where needed.

### Vercel

The Next.js app needs:

```text
DATABASE_URL=...
AUTH_SECRET=...
NEXTAUTH_URL=https://skygen.salru.in
AUTH_URL=https://skygen.salru.in
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MASTRA_SERVER_URL=https://mastra.skygen.salru.in
```

Use Vercel CLI:

```bash
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add AUTH_URL production
vercel env add MASTRA_SERVER_URL production
```

Then redeploy:

```bash
vercel --prod
```

### VPS Mastra Server

The VPS env file lives at:

```text
/opt/videogen-mastra/mastra-server/.env
```

It needs at least:

```text
PORT=4111
NODE_ENV=production
DATABASE_URL=...
AUTH_SECRET=...
NEXTAUTH_URL=https://skygen.salru.in
AUTH_URL=https://skygen.salru.in
```

`AUTH_SECRET` must match Vercel. If it does not match, Mastra cannot decode the Auth.js session cookie and protected wizard routes return `401`.

## Build Locally

From the repo root:

```bash
cd mastra-server
npm install --legacy-peer-deps
npm run build
```

The build output is:

```text
mastra-server/.mastra/output
```

## Deploy Mastra Build To VPS

Package the Mastra output from the repo root:

```bash
tar --exclude=output/node_modules -czf mastra-server/mastra-output.tgz -C mastra-server/.mastra output
```

Upload it:

```bash
python mastra-server/vps.py --file mastra-server/mastra-output.tgz mastra-output.tgz
```

Install the new output on the VPS:

```bash
python mastra-server/vps.py "set -e; cd /opt/videogen-mastra/mastra-server; rm -rf /tmp/mastra-output-deploy .mastra/output.prev-deploy; mkdir -p /tmp/mastra-output-deploy; tar -xzf /root/mastra-output.tgz -C /tmp/mastra-output-deploy; test -f /tmp/mastra-output-deploy/output/index.mjs; if [ -d .mastra/output ]; then mv .mastra/output .mastra/output.prev-deploy; fi; mv /tmp/mastra-output-deploy/output .mastra/output; cd .mastra/output; npm install --omit=dev --legacy-peer-deps --include=optional --no-audit --no-fund; cd /opt/videogen-mastra/mastra-server; pm2 restart videogen-mastra --update-env"
```

Clean the local archive after upload if you want:

```bash
rm mastra-server/mastra-output.tgz
```

On Windows PowerShell, use `Remove-Item mastra-server\mastra-output.tgz`.

## PM2

The PM2 process name is:

```text
videogen-mastra
```

Useful commands:

```bash
pm2 status videogen-mastra
pm2 logs videogen-mastra --lines 100
pm2 restart videogen-mastra --update-env
pm2 save
```

The app should listen on:

```text
http://localhost:4111
```

## nginx

nginx terminates public traffic and proxies to the local Mastra process.

Expected shape:

```nginx
server {
  server_name mastra.skygen.salru.in;

  location / {
    proxy_pass http://127.0.0.1:4111;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Reload nginx:

```bash
nginx -t
systemctl reload nginx
```

## TLS

Use certbot on the VPS:

```bash
certbot --nginx -d mastra.skygen.salru.in
```

Verify renewal:

```bash
certbot renew --dry-run
```

## Smoke Tests

From the VPS:

```bash
curl -i http://localhost:4111/wizard/threads
```

Expected without cookies:

```text
401 Authentication required
```

From your local machine:

```bash
curl -i https://mastra.skygen.salru.in/wizard/threads
```

Expected without cookies:

```text
401 Authentication required
```

That `401` is good. It proves the server is reachable and auth is protecting the route.

## Frontend Proxy Contract

The Vercel app should forward wizard AI requests to the Mastra server:

```text
/api/ai/wizard/chat
/api/ai/wizard/threads
/api/ai/wizard/threads/:threadId
```

The browser should still call the Vercel domain. Vercel forwards the request to:

```text
https://mastra.skygen.salru.in/wizard/...
```

Cookies must be forwarded. Mastra reads the Auth.js session cookie and validates it using `AUTH_SECRET`.

## Google OAuth

Google OAuth belongs to the Vercel app domain, not the Mastra subdomain.

Google Cloud Console should include:

```text
Authorized JavaScript origin:
https://skygen.salru.in

Authorized redirect URI:
https://skygen.salru.in/api/auth/callback/google
```

Do not point Google OAuth callback URLs at the Mastra VPS.

## Common Failures

### Mastra returns 401 after login

Check:

- `AUTH_SECRET` on VPS equals Vercel.
- The frontend proxy forwards the `Cookie` header.
- The request is going through Vercel first, not directly from the browser to Mastra without cookies.

### Mastra cannot connect to Postgres

Check:

- `DATABASE_URL` in `/opt/videogen-mastra/mastra-server/.env`.
- The database allows connections from the VPS.
- If using Supabase, prefer the transaction pooler URL when direct IPv4 access is restricted.

### Build works locally but fails on VPS

Run inside `.mastra/output` on the VPS:

```bash
npm install --omit=dev --legacy-peer-deps --include=optional --no-audit --no-fund
```

This restores Linux optional packages such as Rollup native binaries.

### Preview or plugin creation loops

Check Mastra logs:

```bash
pm2 logs videogen-mastra --lines 150 --nostream
```

Look for:

- schema validation errors
- missing `threadId`
- failed `compilePreview`
- failed `savePendingPlugin`
- stale `previewSourceHash`

## Fast Deploy Checklist

1. Build locally: `cd mastra-server && npm run build`.
2. Tar `.mastra/output`.
3. Upload tarball to VPS with `mastra-server/vps.py`.
4. Replace `/opt/videogen-mastra/mastra-server/.mastra/output`.
5. Run `npm install --omit=dev --legacy-peer-deps --include=optional --no-audit --no-fund` inside the VPS output folder.
6. Restart PM2: `pm2 restart videogen-mastra --update-env`.
7. Smoke test local VPS: `curl -i http://localhost:4111/wizard/threads`.
8. Smoke test public domain: `curl -i https://mastra.skygen.salru.in/wizard/threads`.
9. Redeploy Vercel only if frontend route/env code changed.

