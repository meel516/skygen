import { requireAuthenticatedSession } from "@/lib/api-security"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import crypto from "crypto"

interface TemplateInput {
  id?: string
  name?: string
  description?: string | null
  category?: string
  type?: string
  data?: any
  isPublic?: boolean
  isFreeTier?: boolean
  createdById?: string | null
  previewUrl?: string | null
}

function normalizeTemplateInput(input: any, defaultCreatedById: string) {
  const t: TemplateInput = input?.template ?? input ?? {}
  const id = typeof t.id === "string" && t.id.trim() ? t.id.trim() : crypto.randomUUID()
  const name = typeof t.name === "string" ? t.name.trim() : ""
  const data = t.data ?? null

  return {
    id,
    name,
    description: typeof t.description === "string" ? t.description : null,
    category: typeof t.category === "string" && t.category.trim() ? t.category.trim() : "general",
    type: typeof t.type === "string" && t.type.trim() ? t.type.trim() : "user",
    data,
    isPublic: typeof t.isPublic === "boolean" ? t.isPublic : false,
    isFreeTier: typeof t.isFreeTier === "boolean" ? t.isFreeTier : false,
    createdById: typeof t.createdById === "string" && t.createdById.trim()
      ? t.createdById.trim()
      : defaultCreatedById,
    previewUrl: typeof t.previewUrl === "string" && t.previewUrl.trim() ? t.previewUrl.trim() : null,
  }
}

// GET /api/admin/templates - List all templates (admin only)
export async function GET() {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response
  const { session } = authResult

  try {
    const result = await db.query(`
      SELECT t.id, t.name, t.description, t.category, t.type, t."isPublic", t."isFreeTier", t."createdAt", t."updatedAt",
             u.id AS "createdBy_id", u.name AS "createdBy_name", u.email AS "createdBy_email"
      FROM "Template" t
      LEFT JOIN users u ON u.id = t."createdById"
      ORDER BY t."createdAt" DESC
    `)

    const templates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      type: row.type,
      isPublic: row.isPublic,
      isFreeTier: row.isFreeTier,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy_id ? {
        id: row.createdBy_id,
        name: row.createdBy_name,
        email: row.createdBy_email,
      } : null,
    }))

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

// POST /api/admin/templates - Create template(s) from JSON (admin only)
export async function POST(req: Request) {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response
  const { session } = authResult

  try {
    const body = await req.json()
    const inputs = Array.isArray(body?.templates) ? body.templates : [body]

    if (inputs.length === 0) {
      return NextResponse.json({ error: "No templates provided" }, { status: 400 })
    }

    const created: any[] = []

    for (const input of inputs) {
      const t = normalizeTemplateInput(input, session.user.id)

      if (!t.name) {
        return NextResponse.json({ error: "Template name is required" }, { status: 400 })
      }
      if (!t.data || typeof t.data !== "object") {
        return NextResponse.json({ error: "Template data is required" }, { status: 400 })
      }
      if (!Array.isArray(t.data.blocks)) {
        return NextResponse.json({ error: "Template data.blocks must be an array" }, { status: 400 })
      }

      const result = await db.query(
        `INSERT INTO "Template" (id, name, description, category, type, data, "isPublic", "isFreeTier", "createdById", "previewUrl", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`,
        [
          t.id,
          t.name,
          t.description,
          t.category,
          t.type,
          t.data,
          t.isPublic,
          t.isFreeTier,
          t.createdById,
          t.previewUrl,
        ]
      )

      created.push(result.rows[0])
    }

    return NextResponse.json({ created })
  } catch (error: any) {
    console.error("Error creating template:", error)
    return NextResponse.json(
      { error: "Failed to create template", details: error?.message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/templates - Delete template (admin only)
export async function DELETE(req: Request) {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response

  try {
    const { searchParams } = new URL(req.url)
    const templateId = searchParams.get("id")

    if (!templateId) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 })
    }

    await db.query(`DELETE FROM "Template" WHERE id = $1`, [templateId])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}

// PATCH /api/admin/templates - Update template (admin only)
export async function PATCH(req: Request) {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response

  try {
    const body = await req.json()
    const { templateId, name, description, category, isPublic, isFreeTier } = body

    await db.query(
      `UPDATE "Template"
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           category    = COALESCE($3, category),
           "isPublic"  = COALESCE($4, "isPublic"),
           "isFreeTier" = COALESCE($5, "isFreeTier"),
           "updatedAt" = NOW()
       WHERE id = $6`,
      [name ?? null, description ?? null, category ?? null, isPublic ?? null, isFreeTier ?? null, templateId]
    )

    const updated = await db.query(`SELECT * FROM "Template" WHERE id = $1`, [templateId])
    return NextResponse.json(updated.rows[0])
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}
