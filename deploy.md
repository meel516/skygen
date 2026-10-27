# Deployment Guide

## Remotion Lambda (Video Rendering)

### Prerequisites

These env vars must be set in `.env`:

```
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
REMOTION_AWS_ACCESS_KEY_ID=<same-as-above>
REMOTION_AWS_SECRET_ACCESS_KEY=<same-as-above>
LAMBDA_FUNCTION_NAME=remotion-render-4-0-431-mem3007mb-disk10240mb-900sec
LAMBDA_SITE_URL=https://remotionlambda-useast1-l722vmwfn0.s3.us-east-1.amazonaws.com/sites/skygen-renderer/index.html
LAMBDA_REGION=us-east-1
```

### When to Redeploy

Redeploy the Lambda site **every time** you change any of these:

- `remotion-entry.tsx` (composition entry point)
- `src/lib/video/compositions/DynamicVideo.tsx`
- `src/lib/video/components/**` (VideoScene, TextOverlaySystem, any scene component)
- `src/lib/video/schemas/index.ts`
- `src/lib/video/utils/**` (theme, animations, fonts)

Basically — any file that gets bundled into the Remotion composition.

### Deploy Steps

```bash
# 1. Rebuild the local bundle (also updates mini-services/video-renderer/bundle/)
npm run video:bundle

# 2. Deploy to Lambda S3
npx remotion lambda sites create remotion-entry.tsx --site-name=skygen-renderer --region=us-east-1
```

The command will output a `Serve URL` — if it matches your existing `LAMBDA_SITE_URL`, no `.env` change is needed. If it differs, update `LAMBDA_SITE_URL` in `.env`.

### First-Time Lambda Setup

If setting up Lambda from scratch:

```bash
# 1. Deploy the Lambda function
npx remotion lambda functions deploy --memory=3007 --disk=10240 --timeout=900 --region=us-east-1

# 2. Create the site
npx remotion lambda sites create remotion-entry.tsx --site-name=skygen-renderer --region=us-east-1

# 3. Copy the function name and serve URL into .env
```

### Verify Deployment

```bash
# Check deployed sites
npx remotion lambda sites ls --region=us-east-1

# Check Lambda function
npx remotion lambda functions ls --region=us-east-1
```

---

## Bun Video Renderer (Mini Service)

The local renderer at `mini-services/video-renderer/` uses the same Remotion bundle.

### When to Restart

Restart the Bun renderer after running `npm run video:bundle` — the bundle files are copied to `mini-services/video-renderer/bundle/`.

```bash
# Start/restart the renderer
cd mini-services/video-renderer
bun run index.ts
```

### Schema Updates

The renderer has its own Zod schemas in `mini-services/video-renderer/index.ts`. All block schemas use `.passthrough()` so unknown fields are forwarded to the Remotion bundle without being stripped. If you add a **new block type**, add its schema to the `ContentBlockSchema` discriminated union in that file.

---

## Next.js App

```bash
# Development
npm run dev

# Production build
npm run build && npm start
```

### Key Env Vars

| Variable | Purpose |
|----------|---------|
| `XAI_API_KEY` | Default AI API key (Grok) |
| `GOOGLE_API_KEY` | Veo video generation |
| `GOOGLE_PROJECT_ID` | Vertex AI project |
| `GOOGLE_LOCATION` | Vertex AI region (e.g. `us-central1`) |
| `IMAGE_WEBHOOK_URL` | Image generation webhook |
| `BG_REMOVAL_WEBHOOK` | Background removal webhook |
| `DEEPGRAM_API_KEY` | TTS audio generation |
| `DATABASE_URL` | PostgreSQL connection |
