# SkyGen — Cost & Pricing Reference

Last updated: 2026-03-28

---

## Per-Video Generation Cost

### Assumptions
- ~15 blocks per AI-generated video
- ~6 blocks need images
- ~6,750 characters of TTS narration per video (15 blocks × ~450 chars)
- ~1 min total video duration
- ~37,500 input tokens + ~7,500 output tokens (Gemini)
- ~5 web image searches (Serper)

---

### Service Breakdown

#### AWS Lambda (Remotion rendering)
- Config: `mem3007mb-disk10240mb-900sec`
- Typical render: ~3–4 min
- Cost: 3 GB × 240 sec = 720 GB-sec × $0.0000166667
- **~$0.012 per video**

#### AWS S3
- Site bundle storage + MP4 upload + TTS audio files
- GET requests during Lambda render + PUT for output
- **~$0.001 per video**

#### Vertex AI Imagen (image generation via webhook)
- Imagen 3: $0.03/image
- ~6 images per video
- **~$0.18 per video**

#### TTS — per provider

| Provider | Model | Cost/1k chars | Cost per video (6,750 chars) |
|---|---|---|---|
| Deepgram | Aura 2 | $0.015 | **$0.10** |
| **Cartesia** | **Sonic 2** | **$0.0065** | **$0.044** |
| ElevenLabs | Eleven v3 | $0.30 | $2.00 |
| Gemini | 2.5 Pro TTS | ~$0.012 | ~$0.08 |

#### Google Gemini (AI content generation)
- Model: `gemini-2.5-flash`
- $0.15/1M input tokens, $0.60/1M output tokens
- **~$0.011 per video**

#### Serper.dev (web image search)
- $50/mo = 50,000 searches
- ~5 searches per video
- **~$0.005 per video**

---

### Total Per Video

| Scenario | Cost |
|---|---|
| Deepgram voice | **~$0.31** |
| **Cartesia voice (recommended)** | **~$0.24** |
| ElevenLabs voice | **~$2.13** |
| Gemini TTS voice | **~$0.28** |

> Cartesia is the sweet spot — 57% cheaper than Deepgram, better quality, $0.24/video total.

---

## Monthly Fixed Costs

| Service | Cost |
|---|---|
| Vercel Pro | $20/mo |
| Neon PostgreSQL | $0–19/mo |
| Serper.dev | $50/mo |
| **Total fixed** | **~$70–89/mo** |

---

## Scale Scenarios

### Free Tier Users (10 videos each, Cartesia voice)

| Users | Videos | Variable Cost | Fixed | Total |
|---|---|---|---|---|
| 10 | 100 | $24 | $89 | **$113/mo** |
| 50 | 500 | $120 | $89 | **$209/mo** |
| 100 | 1,000 | $240 | $89 | **$329/mo** |
| 500 | 5,000 | $1,200 | $89 | **$1,289/mo** |

### Break-even Pricing

To cover costs at $0.24/video variable + $89 fixed:

| Free videos/user | Premium price to break even at 100 users |
|---|---|
| 10 free | $3.29/user/mo (min) |
| 5 free | $1.69/user/mo (min) |

**Recommended pricing:**
- Free tier: 5 videos/month
- Pro: $9.99/month → 50 videos
- Business: $29.99/month → unlimited

At 100 Pro users × $9.99 = $999/mo revenue vs ~$329/mo cost = **$670/mo profit margin**

---

## Cost Optimization Tips

1. **Use Cartesia over Deepgram** — 57% cheaper, better quality (already implemented)
2. **Switch image gen to Together AI Flux Schnell** — $0.0008/image vs $0.03 = 37× cheaper, reduces per-video cost to ~$0.07
3. **Cache images by topic** — same topic reuses generated images, cuts image cost to near zero for popular topics
4. **Gate ElevenLabs behind premium** — $2/video is only viable at premium pricing
5. **Reduce blocks on free tier** — cap free tier at 8 blocks/video instead of 15

### With Together AI images instead of Vertex:

| Scenario | Current | Optimized |
|---|---|---|
| Images (6/video) | $0.18 | $0.005 |
| TTS (Cartesia) | $0.044 | $0.044 |
| Lambda | $0.012 | $0.012 |
| Other | $0.016 | $0.016 |
| **Total** | **$0.24** | **$0.077** |

At $0.077/video, 1,000 free videos costs **$77** instead of **$240**.

---

## API Keys Reference

| Service | Env Var | Docs |
|---|---|---|
| AWS Lambda/S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | AWS Console |
| Deepgram | `DEEPGRAM_API_KEY` | deepgram.com/console |
| Cartesia | `CARTESIA_API_KEY` | cartesia.ai/dashboard |
| ElevenLabs | `ELEVENLABS_API_KEY` | elevenlabs.io |
| Google Vertex | `GOOGLE_API_KEY`, `GOOGLE_PROJECT_ID` | Google Cloud Console |
| Serper | `SERPER_API_KEY` | serper.dev |
