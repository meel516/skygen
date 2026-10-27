import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

// arc_pattern (JSONB) — the AI layer of a story arc.
// This is what graph.ts uses to structure the video narrative.
// Shape: { roles: string[], defaultTone: string }
//   roles       — ordered list of narrative roles assigned to each video block
//                 (e.g. ["hook","context","build-up","climax","resolution"])
//   defaultTone — prose description of the overall emotional register, injected
//                 verbatim into the director_agent prompt
// When null/empty, graph.ts falls back to the hardcoded ARC_PATTERNS in graph.ts.

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS story_arcs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  description TEXT NOT NULL DEFAULT '',
  arc_pattern JSONB DEFAULT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

// Migration: add arc_pattern column to existing tables
const MIGRATE = `ALTER TABLE story_arcs ADD COLUMN IF NOT EXISTS arc_pattern JSONB DEFAULT NULL`;

const DEFAULT_ARCS: Array<{
  id: string; label: string; emoji: string; description: string;
  is_premium: boolean; sort_order: number;
  arc_pattern: { roles: string[]; defaultTone: string } | null;
}> = [
  { id: '', label: 'Auto-detect', emoji: '✨', description: 'AI picks the best arc for your story (recommended)', is_premium: false, sort_order: 0, arc_pattern: null },
  { id: 'documentary', label: 'Documentary', emoji: '🎬', description: 'Biographical, sports, or historical stories', is_premium: true, sort_order: 1, arc_pattern: { roles: ['hook','context','build-up','climax','proof','resolution'], defaultTone: 'cinematic, inspiring, emotionally building toward a peak moment' } },
  { id: 'listicle', label: 'Listicle', emoji: '📋', description: 'Rankings, top-N lists, countdowns', is_premium: true, sort_order: 2, arc_pattern: { roles: ['intro','item','item','item','item','summary'], defaultTone: 'energetic, punchy, fast-paced — each item lands like a reveal' } },
  { id: 'tutorial', label: 'Tutorial', emoji: '📚', description: 'How-to guides, step-by-step instructions', is_premium: true, sort_order: 3, arc_pattern: { roles: ['intro','step','step','step','step','recap'], defaultTone: 'clear, instructional, reassuring — builds confidence step by step' } },
  { id: 'product_pitch', label: 'Product Pitch', emoji: '🚀', description: 'Product launches, feature showcases', is_premium: true, sort_order: 4, arc_pattern: { roles: ['problem','solution','feature','feature','social_proof','cta'], defaultTone: 'confident, persuasive, building excitement toward a strong CTA' } },
  { id: 'biography', label: 'Biography', emoji: '👤', description: 'Life stories, career journeys', is_premium: true, sort_order: 5, arc_pattern: { roles: ['origin','rise','challenge','triumph','legacy','inspiration'], defaultTone: 'personal, emotional, nostalgic — earns the emotion through specific detail' } },
  { id: 'news', label: 'News', emoji: '📰', description: 'Current events, announcements', is_premium: true, sort_order: 6, arc_pattern: { roles: ['headline','context','detail','detail','impact','conclusion'], defaultTone: 'authoritative, neutral, informative — facts first, then significance' } },
  { id: 'motivational', label: 'Motivational', emoji: '🔥', description: 'Inspirational, self-improvement', is_premium: true, sort_order: 7, arc_pattern: { roles: ['problem','struggle','turning_point','triumph','principle','cta'], defaultTone: 'intense, uplifting, urgent — creates a desire to act' } },
  { id: 'comparison', label: 'Comparison', emoji: '⚖️', description: 'Versus content, head-to-head reviews', is_premium: true, sort_order: 8, arc_pattern: { roles: ['intro','contender_a','contender_b','round','round','verdict'], defaultTone: 'analytical, balanced, building to a decisive verdict' } },
  { id: 'mini_doc', label: 'Mini Doc', emoji: '🎥', description: 'Short-form documentary, tight arc', is_premium: true, sort_order: 9, arc_pattern: { roles: ['hook','context','tension','resolution','cta'], defaultTone: 'cinematic, tight, every second earns its place' } },
  { id: 'explainer', label: 'Explainer', emoji: '💡', description: 'Concept breakdowns, "what is X"', is_premium: true, sort_order: 10, arc_pattern: { roles: ['hook_question','analogy','detail','detail','summary','insight'], defaultTone: 'curious, clear, surprising — makes complex things feel simple' } },
  { id: 'event_recap', label: 'Event Recap', emoji: '🏆', description: 'Sports recaps, event summaries', is_premium: true, sort_order: 11, arc_pattern: { roles: ['teaser','setup','key_moment','key_moment','result','reaction'], defaultTone: 'exciting, play-by-play energy, relives the moment' } },
  { id: 'brand_story', label: 'Brand Story', emoji: '🏷️', description: 'Company origins, mission-driven', is_premium: true, sort_order: 12, arc_pattern: { roles: ['problem_in_world','founder_moment','mission','proof','values','cta'], defaultTone: 'purposeful, warm, authentic — values over hype' } },
  { id: 'reaction', label: 'Reaction', emoji: '🗣️', description: 'Commentary, hot takes, opinions', is_premium: true, sort_order: 13, arc_pattern: { roles: ['hook','claim','evidence','counter','verdict','takeaway'], defaultTone: 'bold, opinionated, conversational — like talking to a friend who knows their stuff' } },
  { id: 'transformation', label: 'Transformation', emoji: '🦋', description: 'Before/after, glow-ups, makeovers', is_premium: true, sort_order: 14, arc_pattern: { roles: ['before','catalyst','process','struggle','reveal','impact'], defaultTone: 'dramatic, building anticipation — the reveal is everything' } },
  { id: 'mystery', label: 'Mystery', emoji: '🔍', description: 'True crime, unsolved, conspiracy', is_premium: true, sort_order: 15, arc_pattern: { roles: ['hook_question','clue','clue','twist','reveal','aftermath'], defaultTone: 'suspenseful, eerie, slow-burn tension — keeps you guessing' } },
  { id: 'storytime', label: 'Storytime', emoji: '📖', description: 'Personal anecdotes, narratives', is_premium: true, sort_order: 16, arc_pattern: { roles: ['setup','inciting_incident','escalation','climax','fallout','lesson'], defaultTone: 'casual, gripping, conversational — like the best storyteller at a party' } },
  { id: 'review', label: 'Review', emoji: '⭐', description: 'Product/movie/game reviews', is_premium: true, sort_order: 17, arc_pattern: { roles: ['intro','first_impression','deep_dive','pros','cons','verdict'], defaultTone: 'honest, analytical, entertaining — earns trust through detail' } },
  { id: 'day_in_life', label: 'Day in Life', emoji: '☀️', description: 'Routines, behind-the-scenes', is_premium: true, sort_order: 18, arc_pattern: { roles: ['morning','routine','highlight','challenge','wind_down','reflection'], defaultTone: 'intimate, relatable, authentic — makes viewers feel like they were there' } },
  { id: 'myth_busting', label: 'Myth Busting', emoji: '🧪', description: 'Debunking, fact vs fiction', is_premium: true, sort_order: 19, arc_pattern: { roles: ['myth_intro','common_belief','evidence','truth','implications','takeaway'], defaultTone: 'confident, surprising, "actually..." energy — flips assumptions' } },
  { id: 'countdown', label: 'Countdown', emoji: '⏬', description: 'Dramatic reveals, tension builds', is_premium: true, sort_order: 20, arc_pattern: { roles: ['teaser','entry','entry','entry','runner_up','winner'], defaultTone: 'escalating excitement, each entry bigger than the last — saves the best for last' } },
];

async function ensureTable() {
  await db.query(ENSURE_TABLE);
  await db.query(MIGRATE);
  const { rows } = await db.query('SELECT COUNT(*) as count FROM story_arcs');
  if (parseInt(rows[0].count) === 0) {
    for (const arc of DEFAULT_ARCS) {
      await db.query(
        `INSERT INTO story_arcs (id, label, emoji, description, arc_pattern, is_premium, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [arc.id, arc.label, arc.emoji, arc.description, arc.arc_pattern ? JSON.stringify(arc.arc_pattern) : null, arc.is_premium, arc.sort_order]
      );
    }
  } else {
    // Backfill arc_pattern for existing rows that don't have it yet
    for (const arc of DEFAULT_ARCS) {
      if (arc.arc_pattern) {
        await db.query(
          `UPDATE story_arcs SET arc_pattern = $2 WHERE id = $1 AND arc_pattern IS NULL`,
          [arc.id, JSON.stringify(arc.arc_pattern)]
        );
      }
    }
  }
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await db.query('SELECT * FROM story_arcs ORDER BY sort_order ASC, created_at ASC');
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;
  try {
    await ensureTable();
    const body = await req.json();
    const { id, label, emoji, description, arc_pattern, is_premium, sort_order } = body;
    if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 });
    const arcId = id?.trim() || label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await db.query(
      `INSERT INTO story_arcs (id, label, emoji, description, arc_pattern, is_premium, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET label=$2, emoji=$3, description=$4, arc_pattern=$5, is_premium=$6, sort_order=$7, updated_at=NOW()`,
      [arcId, label.trim(), emoji || '📋', description || '', arc_pattern ? JSON.stringify(arc_pattern) : null, is_premium ?? true, sort_order ?? 0]
    );
    return NextResponse.json({ success: true, id: arcId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;
  try {
    const body = await req.json();
    const { id, label, emoji, description, arc_pattern, is_premium, is_active, sort_order } = body;
    if (id === undefined) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.query(
      `UPDATE story_arcs SET
        label=COALESCE($2,label), emoji=COALESCE($3,emoji), description=COALESCE($4,description),
        arc_pattern=COALESCE($5,arc_pattern), is_premium=COALESCE($6,is_premium),
        is_active=COALESCE($7,is_active), sort_order=COALESCE($8,sort_order), updated_at=NOW()
       WHERE id=$1`,
      [id, label, emoji, description, arc_pattern !== undefined ? JSON.stringify(arc_pattern) : null, is_premium, is_active, sort_order]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;
  try {
    const { id } = await req.json();
    await db.query('DELETE FROM story_arcs WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
