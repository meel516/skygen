import { requireAuthenticatedSession } from "@/lib/api-security"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

// GET /api/admin/users - List all users (admin only)
// Excludes soft-deleted users by default; pass ?deleted=1 to see them.
export async function GET(req: NextRequest) {
  const showDeleted = req.nextUrl.searchParams.get('deleted') === '1';
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response

  try {
    const result = await db.query(`
      SELECT
        u.id, u.email, u.name, u.role,
        COALESCE(u."videoCount", 0)       AS "videoCount",
        COALESCE(u."videoLimit", 10)      AS "videoLimit",
        COALESCE(u."aiCount", 0)          AS "aiCount",
        COALESCE(u."aiLimit", 20)         AS "aiLimit",
        COALESCE(u."aiTokensUsed", 0)     AS "aiTokensUsed",
        COALESCE(u."aiTokenLimit", 100000) AS "aiTokenLimit",
        u."createdAt",
        u.deleted_at,
        (SELECT COUNT(*)::int FROM "Template" t WHERE t."createdById" = u.id) AS "templateCount",
        (SELECT COUNT(*)::int FROM "Video"    v WHERE v."userId"      = u.id) AS "videoRecordCount"
      FROM users u
      WHERE ${showDeleted ? 'TRUE' : 'u.deleted_at IS NULL'}
      ORDER BY u."createdAt" DESC
    `)

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      videoCount: row.videoCount,
      videoLimit: row.videoLimit,
      aiCount: row.aiCount,
      aiLimit: row.aiLimit,
      aiTokensUsed: row.aiTokensUsed,
      aiTokenLimit: row.aiTokenLimit,
      createdAt: row.createdAt,
      _count: {
        templates: row.templateCount,
        videos: row.videoRecordCount,
      },
    }))

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// PATCH /api/admin/users - Update user (admin only)
export async function PATCH(req: Request) {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response

  try {
    const { userId, role, videoLimit, aiLimit, action } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    if (action === "resetUsage") {
      await db.query(
        `UPDATE users SET "videoCount" = 0, "aiCount" = 0, "aiTokensUsed" = 0 WHERE id = $1`,
        [userId]
      )
      return NextResponse.json({ success: true })
    }

    if (action === "updateRole" && role) {
      await db.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId])
      return NextResponse.json({ success: true })
    }

    if (action === "updateLimit") {
      if (videoLimit != null) {
        await db.query(`UPDATE users SET "videoLimit" = $1 WHERE id = $2`, [videoLimit, userId])
      }
      if (aiLimit != null) {
        await db.query(`UPDATE users SET "aiLimit" = $1 WHERE id = $2`, [aiLimit, userId])
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// DELETE /api/admin/users - Soft-delete a user and ban their email (admin only)
// Soft-deletes the user row (sets deleted_at) and adds their email to banned_emails
// so they can never sign back in even if the users row is later hard-deleted.
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true })
  if ('response' in authResult) return authResult.response

  try {
    const { userId, reason } = await req.json()
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    // Get the user's email before deleting
    const userResult = await db.query(`SELECT email FROM users WHERE id = $1`, [userId])
    const userEmail = userResult.rows[0]?.email

    // Soft-delete the user row
    await db.query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1`,
      [userId]
    )

    // Ban their email so they can never re-register via Google login
    if (userEmail) {
      await db.query(
        `INSERT INTO banned_emails (email, reason) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
        [userEmail, reason || 'Deleted by admin']
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
