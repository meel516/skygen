import { requireAuthenticatedSession } from "@/lib/api-security"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// POST - Create public template (admin only)
export async function POST(req: Request) {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response

  try {
    const body = await req.json()
    const { name, description, category, type, data, isFreeTier = false } = body

    const result = await db.query(
      `INSERT INTO "Template" (id, name, description, category, type, data, "isPublic", "isFreeTier", "createdById", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, true, $6, NULL, NOW(), NOW())
       RETURNING *`,
      [name || 'Untitled', description || '', category || 'general', type || 'public', JSON.stringify(data || {}), !!isFreeTier]
    )

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - List public templates
// Authenticated users see all public templates; anonymous users see only free-tier ones
export async function GET() {
  const authResult = await requireAuthenticatedSession().catch(() => null)
  const isAdmin = authResult && !('response' in authResult)
    ? authResult.session.user.role === 'ADMIN'
    : false

  try {
    // Admins see all public templates; everyone else sees only free-tier
    const query = isAdmin
      ? `SELECT * FROM "Template" WHERE "isPublic" = true ORDER BY "createdAt" DESC`
      : `SELECT id, name, description, category, type, data, "previewUrl", "isPublic", "isFreeTier", "createdAt"
         FROM "Template"
         WHERE "isPublic" = true AND COALESCE("isFreeTier", false) = true
         ORDER BY "createdAt" DESC`

    const result = await db.query(query)
    return NextResponse.json(result.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
