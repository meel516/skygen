import { requireAuthenticatedSession } from "@/lib/api-security"
import { db } from "@/lib/db"
import { hasPremiumAccess } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"

// GET /api/templates/[id] - Fetch a single template with its blocks
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const result = await db.query('SELECT * FROM "Template" WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    const row = result.rows[0]
    const blocks = Array.isArray(row.data?.blocks) ? row.data.blocks : (Array.isArray(row.data) ? row.data : [])
    return NextResponse.json({ ...row, blocks })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

// PATCH /api/templates/[id] - Update a template (owner only; supports MCP Bearer sk-vg-...)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedSession()
  if ('response' in authResult) return authResult.response
  const { session } = authResult
  const { id } = await params

  if (!hasPremiumAccess(session.user.role)) {
    return NextResponse.json({ error: "Premium required to manage templates" }, { status: 403 })
  }

  try {
    const existing = await db.query(
      'SELECT "createdById" FROM "Template" WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    if (existing.rows[0].createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, category, isPublic, data, previewUrl } = body

    await db.query(
      `UPDATE "Template"
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           "isPublic" = COALESCE($4, "isPublic"),
           data = COALESCE($5, data),
           "previewUrl" = COALESCE($6, "previewUrl"),
           "updatedAt" = NOW()
       WHERE id = $7`,
      [name ?? null, description ?? null, category ?? null, isPublic ?? null, data ? JSON.stringify(data) : null, previewUrl ?? null, id]
    )

    const updated = await db.query('SELECT * FROM "Template" WHERE id = $1', [id])
    const row = updated.rows[0]
    const blocks = Array.isArray(row.data?.blocks) ? row.data.blocks : (Array.isArray(row.data) ? row.data : [])
    return NextResponse.json({ ...row, blocks })
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

// DELETE /api/templates/[id] - Delete a template (supports MCP Bearer sk-vg-...)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedSession()
  if ('response' in authResult) return authResult.response
  const { session } = authResult
  const { id } = await params

  if (!hasPremiumAccess(session.user.role)) {
    return NextResponse.json({ error: "Premium required to manage templates" }, { status: 403 })
  }

  try {
    const result = await db.query(
      'SELECT "createdById" FROM "Template" WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    if (result.rows[0].createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.query('DELETE FROM "Template" WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
