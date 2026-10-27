import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { hasPremiumAccess } from "@/lib/roles"
import { NextResponse } from "next/server"

// POST /api/templates/[id]/public - Make template public
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!hasPremiumAccess(session.user.role)) {
    return NextResponse.json({ error: "Premium required to publish templates" }, { status: 403 })
  }

  try {
    // Check if template exists and user owns it
    const result = await db.query(
      'SELECT * FROM "Template" WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const template = result.rows[0]

    // Allow if user owns it OR user is admin
    const userResult = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [session.user.id]
    )
    const isAdmin = userResult.rows[0]?.role === 'ADMIN'

    if (template.createdById !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Make public
    await db.query(
      'UPDATE "Template" SET "isPublic" = true, "updatedAt" = NOW() WHERE id = $1',
      [id]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error making template public:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
