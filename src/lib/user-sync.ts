import { db } from "@/lib/db"

export async function syncUser(user: { id: string; email?: string | null; name?: string | null; image?: string | null }) {
  try {
    if (user.email) {
      // Check banned_emails first — permanently blocked users (hard-deleted via admin)
      try {
        const banned = await db.query(
          `SELECT email FROM banned_emails WHERE email = $1`,
          [user.email]
        )
        if (banned.rows.length > 0) {
          return { blocked: true }
        }
      } catch {
        // banned_emails table doesn't exist yet (migration pending) — skip check
      }

      // Check soft-deleted users (deleted_at may not exist yet either)
      try {
        const deleted = await db.query(
          `SELECT id FROM users WHERE email = $1 AND deleted_at IS NOT NULL`,
          [user.email]
        )
        if (deleted.rows.length > 0) {
          return { blocked: true }
        }
      } catch {
        // deleted_at column doesn't exist yet (migration pending) — skip check
      }

      // Look up by email first — stable cross-device identifier.
      // ON CONFLICT (email): reuses existing account if found, never creates duplicate.
      await db.query(
        `INSERT INTO users (id, email, name, role, "videoCount", "videoLimit")
         VALUES ($1, $2, $3, 'USER', 0, 10)
         ON CONFLICT (email) DO UPDATE
           SET name = COALESCE(EXCLUDED.name, users.name)
         WHERE users.deleted_at IS NULL
        `,
        [user.id, user.email, user.name ?? null]
      )
    } else {
      // No email — fall back to id-based upsert
      await db.query(
        `INSERT INTO users (id, email, name, role, "videoCount", "videoLimit")
         VALUES ($1, $2, $3, 'USER', 0, 10)
         ON CONFLICT (id) DO UPDATE
           SET email = COALESCE(EXCLUDED.email, users.email),
               name  = COALESCE(EXCLUDED.name,  users.name)
         WHERE users.deleted_at IS NULL
        `,
        [user.id, user.email ?? null, user.name ?? null]
      )
    }

    const result = await db.query(
      `SELECT id, role, "videoCount", "videoLimit", deleted_at FROM users WHERE email = $1`,
      [user.email ?? null]
    )

    const row = result.rows[0]
    if (!row || row.deleted_at) return { blocked: true }

    return row
  } catch (e) {
    console.error("Sync user error:", e)
    return { role: "USER", videoCount: 0, videoLimit: 10 }
  }
}
