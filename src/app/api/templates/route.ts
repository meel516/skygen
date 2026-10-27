import { requireAuthenticatedSession } from "@/lib/api-security"
import { db } from "@/lib/db"
import { hasPremiumAccess } from "@/lib/roles"
import { NextResponse } from "next/server"

// GET /api/templates - List templates available to the current user
// Premium/Admin: their own templates + all public templates
// Free-tier: public free-tier templates only
export async function GET() {
  const authResult = await requireAuthenticatedSession()
  if ('response' in authResult) return authResult.response

  const { session } = authResult
  const userId = session.user.id
  const role = session.user.role

  try {
    if (hasPremiumAccess(role)) {
      // Premium users see their own + all public templates
      const result = await db.query(
        `SELECT id, name, description, category, type, data, "isPublic", "isFreeTier", "previewUrl", "createdById", "createdAt", "updatedAt"
         FROM "Template"
         WHERE "createdById" = $1 OR "isPublic" = true
         ORDER BY "createdAt" DESC`,
        [userId]
      )
      return NextResponse.json(result.rows)
    }

    // Free-tier users see public free-tier templates only
    const result = await db.query(
      `SELECT id, name, description, category, type, data, "isPublic", "isFreeTier", "previewUrl", "createdAt"
       FROM "Template"
       WHERE "isPublic" = true AND COALESCE("isFreeTier", false) = true
       ORDER BY "createdAt" DESC`
    )
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

// POST /api/templates - Create a new template (premium only)
export async function POST(req: Request) {
  const authResult = await requireAuthenticatedSession()
  if ('response' in authResult) return authResult.response

  const { session } = authResult

  if (!hasPremiumAccess(session.user.role)) {
    return NextResponse.json(
      { error: "Premium required to save templates" },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { name, description, category, type, data, isPublic, previewUrl } = body

    const result = await db.query(
      `INSERT INTO "Template" (id, name, description, category, type, data, "isPublic", "createdById", "previewUrl", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [name || 'Untitled', description || '', category || 'general', type || 'user', JSON.stringify(data || {}), isPublic ? true : false, session.user.id, previewUrl || null]
    )

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error("[Template] Error:", error.message || error)
    return NextResponse.json({ error: "Failed to create template: " + (error.message || 'Unknown error') }, { status: 500 })
  }
}
