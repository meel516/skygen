import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

// prompt_prefix (TEXT) — the AI layer of a visual style.
// This is prepended to every image-generation prompt for this style, ensuring
// visual consistency across all scenes in the video.
// Example: "Hyperrealistic cinematic photography, shallow depth of field,
//           dramatic lighting, film grain, 8K detail"
// When null/empty, graph.ts falls back to VISUAL_STYLE_PRESETS in graph.ts.

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS visual_styles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎨',
  description TEXT NOT NULL DEFAULT '',
  prompt_prefix TEXT DEFAULT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const MIGRATE = `ALTER TABLE visual_styles ADD COLUMN IF NOT EXISTS prompt_prefix TEXT DEFAULT NULL`;

const DEFAULT_STYLES: Array<{
  id: string; label: string; emoji: string; description: string;
  prompt_prefix: string | null; is_premium: boolean; sort_order: number;
}> = [
  { id: '', label: 'Auto-detect', emoji: '✨', description: 'AI picks the best style for your story', prompt_prefix: null, is_premium: false, sort_order: 0 },
  { id: 'photorealistic', label: 'Photorealistic', emoji: '📸', description: 'Cinematic photography, dramatic lighting', prompt_prefix: 'Hyperrealistic cinematic photography, shallow depth of field, dramatic lighting, film grain, 8K detail', is_premium: true, sort_order: 1 },
  { id: 'anime', label: 'Anime', emoji: '🎨', description: 'Japanese anime, cel-shaded, vibrant', prompt_prefix: 'Anime art style, cel-shaded, vibrant saturated colors, dynamic composition, soft ambient lighting, Studio Ghibli meets modern anime', is_premium: true, sort_order: 2 },
  { id: '3d-cinematic', label: '3D Cinematic', emoji: '🧊', description: 'Pixar-quality 3D render, volumetric', prompt_prefix: '3D cinematic render, Pixar-quality, volumetric lighting, dramatic shadows, rich textures, depth of field', is_premium: true, sort_order: 3 },
  { id: 'cartoon', label: 'Cartoon', emoji: '✏️', description: 'Bold outlines, flat colors, expressive', prompt_prefix: 'Bold cartoon illustration style, thick outlines, flat vibrant colors, exaggerated expressions, clean vector art', is_premium: true, sort_order: 4 },
  { id: 'watercolor', label: 'Watercolor', emoji: '💧', description: 'Soft brushstrokes, pastel palette', prompt_prefix: 'Soft watercolor painting, flowing brushstrokes, muted pastel palette, organic textures, dreamy ethereal mood', is_premium: true, sort_order: 5 },
  { id: 'comic-book', label: 'Comic Book', emoji: '💥', description: 'Bold ink, halftone dots, action poses', prompt_prefix: 'Comic book art style, bold ink outlines, halftone dots, dramatic shading, dynamic action poses, vivid saturated colors', is_premium: true, sort_order: 6 },
  { id: 'pixel-art', label: 'Pixel Art', emoji: '👾', description: 'Retro 16-bit, nostalgic game aesthetic', prompt_prefix: 'Retro pixel art, 16-bit style, limited color palette, crisp pixels, nostalgic game aesthetic', is_premium: true, sort_order: 7 },
  { id: 'oil-painting', label: 'Oil Painting', emoji: '🖼️', description: 'Classical impasto, warm chiaroscuro', prompt_prefix: 'Classical oil painting, rich impasto brushwork, warm chiaroscuro lighting, Renaissance-inspired composition', is_premium: true, sort_order: 8 },
  { id: 'neon-cyberpunk', label: 'Neon Cyberpunk', emoji: '🌃', description: 'Glowing neon, dark moody, holographic', prompt_prefix: 'Cyberpunk neon aesthetic, glowing neon lights, dark moody atmosphere, rain-slicked surfaces, holographic accents, purple and cyan palette', is_premium: true, sort_order: 9 },
  { id: 'vintage-film', label: 'Vintage Film', emoji: '📽️', description: 'Sepia tones, light leaks, film grain', prompt_prefix: 'Vintage film photography, warm sepia undertones, light leaks, soft vignette, 1970s color grading, analog film grain', is_premium: true, sort_order: 10 },
  { id: 'minimalist', label: 'Minimalist', emoji: '◻️', description: 'Clean lines, whitespace, geometric', prompt_prefix: 'Minimalist design, clean lines, generous whitespace, limited color palette, geometric shapes, modern typography-driven', is_premium: true, sort_order: 11 },
  { id: 'dark-moody', label: 'Dark & Moody', emoji: '🌑', description: 'Deep shadows, rim lighting, noir', prompt_prefix: 'Dark moody atmosphere, deep shadows, rim lighting, desaturated tones with selective color, cinematic noir feeling', is_premium: true, sort_order: 12 },
  { id: 'custom', label: 'Custom', emoji: '✍️', description: 'Describe your own visual style', prompt_prefix: null, is_premium: true, sort_order: 13 },
];

async function ensureTable() {
  await db.query(ENSURE_TABLE);
  await db.query(MIGRATE);
  const { rows } = await db.query('SELECT COUNT(*) as count FROM visual_styles');
  if (parseInt(rows[0].count) === 0) {
    for (const style of DEFAULT_STYLES) {
      await db.query(
        `INSERT INTO visual_styles (id, label, emoji, description, prompt_prefix, is_premium, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [style.id, style.label, style.emoji, style.description, style.prompt_prefix, style.is_premium, style.sort_order]
      );
    }
  } else {
    // Backfill prompt_prefix for existing rows that don't have it yet
    for (const style of DEFAULT_STYLES) {
      if (style.prompt_prefix) {
        await db.query(
          `UPDATE visual_styles SET prompt_prefix = $2 WHERE id = $1 AND prompt_prefix IS NULL`,
          [style.id, style.prompt_prefix]
        );
      }
    }
  }
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await db.query('SELECT * FROM visual_styles ORDER BY sort_order ASC, created_at ASC');
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
    const { id, label, emoji, description, prompt_prefix, is_premium, sort_order } = body;
    if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 });
    const styleId = id?.trim() || label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.query(
      `INSERT INTO visual_styles (id, label, emoji, description, prompt_prefix, is_premium, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET label=$2, emoji=$3, description=$4, prompt_prefix=$5, is_premium=$6, sort_order=$7, updated_at=NOW()`,
      [styleId, label.trim(), emoji || '🎨', description || '', prompt_prefix || null, is_premium ?? true, sort_order ?? 0]
    );
    return NextResponse.json({ success: true, id: styleId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;
  try {
    const body = await req.json();
    const { id, label, emoji, description, prompt_prefix, is_premium, is_active, sort_order } = body;
    if (id === undefined) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.query(
      `UPDATE visual_styles SET
        label=COALESCE($2,label), emoji=COALESCE($3,emoji), description=COALESCE($4,description),
        prompt_prefix=COALESCE($5,prompt_prefix), is_premium=COALESCE($6,is_premium),
        is_active=COALESCE($7,is_active), sort_order=COALESCE($8,sort_order), updated_at=NOW()
       WHERE id=$1`,
      [id, label, emoji, description, prompt_prefix, is_premium, is_active, sort_order]
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
    await db.query('DELETE FROM visual_styles WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
