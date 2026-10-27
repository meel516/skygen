import { db } from './db';

/**
 * Simple versioned migration system.
 * Each migration runs once — tracked by version number in the migrations table.
 * All migrations use IF NOT EXISTS / IF EXISTS so they're safe to re-run.
 */

interface Migration {
  version: number;
  name: string;
  up: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_users',
    up: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        role TEXT DEFAULT 'USER',
        "videoCount" INTEGER DEFAULT 0,
        "videoLimit" INTEGER DEFAULT 10,
        "aiCount" INTEGER DEFAULT 0,
        "aiLimit" INTEGER DEFAULT 20,
        "aiTokensUsed" INTEGER DEFAULT 0,
        "aiTokenLimit" INTEGER DEFAULT 100000,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
    ],
  },
  {
    version: 2,
    name: 'create_templates',
    up: [
      `CREATE TABLE IF NOT EXISTS "Template" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'general',
        type TEXT DEFAULT 'user',
        data JSONB DEFAULT '{}'::jsonb,
        "isPublic" BOOLEAN DEFAULT false,
        "isFreeTier" BOOLEAN DEFAULT false,
        "createdById" TEXT,
        "previewUrl" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
    ],
  },
  {
    version: 3,
    name: 'create_videos',
    up: [
      `CREATE TABLE IF NOT EXISTS "Video" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        data JSONB DEFAULT '{}'::jsonb,
        url TEXT,
        duration INTEGER,
        "userId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,
    ],
  },
  {
    version: 4,
    name: 'create_youtube_accounts',
    up: [
      `CREATE TABLE IF NOT EXISTS youtube_accounts (
        user_id      TEXT PRIMARY KEY,
        access_token  TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date   BIGINT,
        updated_at    TIMESTAMPTZ DEFAULT now()
      )`,
    ],
  },
  {
    version: 5,
    name: 'add_user_columns',
    up: [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "aiCount" INTEGER DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "aiLimit" INTEGER DEFAULT 20`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "aiTokensUsed" INTEGER DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "aiTokenLimit" INTEGER DEFAULT 100000`,
    ],
  },
  {
    version: 6,
    name: 'add_video_columns',
    up: [
      `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS url TEXT`,
      `ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS duration INTEGER`,
      `ALTER TABLE "Video" DROP CONSTRAINT IF EXISTS "Video_userId_fkey"`,
    ],
  },
  {
    version: 7,
    name: 'create_site_config_and_block_thumbnails',
    up: [
      `CREATE TABLE IF NOT EXISTS site_config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS block_thumbnails (
        block_type TEXT PRIMARY KEY,
        thumbnail_url TEXT,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
      )`,
    ],
  },
  {
    version: 8,
    name: 'add_template_free_tier_flag',
    up: [
      `ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "isFreeTier" BOOLEAN DEFAULT false`,
    ],
  },
  {
    version: 9,
    name: 'create_staged_payloads',
    up: [
      `CREATE TABLE IF NOT EXISTS staged_payloads (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ],
  },
  {
    version: 10,
    name: 'create_linkedin_accounts',
    up: [
      `CREATE TABLE IF NOT EXISTS linkedin_accounts (
        user_id       TEXT PRIMARY KEY,
        access_token  TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date   BIGINT,
        updated_at    TIMESTAMPTZ DEFAULT now()
      )`,
    ],
  },
  {
    version: 11,
    name: 'create_music_tracks',
    up: [
      `CREATE TABLE IF NOT EXISTS music_tracks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        artist TEXT NOT NULL DEFAULT 'Unknown',
        mood TEXT NOT NULL DEFAULT 'calm',
        duration INTEGER NOT NULL DEFAULT 120,
        src TEXT NOT NULL,
        tags TEXT[] DEFAULT '{}',
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "createdBy" TEXT
      )`,
    ],
  },
  {
    version: 12,
    name: 'unique_email_on_users',
    up: [
      // Remove duplicate email rows first — keep the oldest row per email
      `DELETE FROM users a USING users b
       WHERE a.email = b.email AND a."createdAt" > b."createdAt"`,
      // Add unique constraint so the same email can never create two accounts
      `ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)`,
    ],
  },
  {
    version: 13,
    name: 'soft_delete_users',
    up: [
      // Soft delete: deleted_at marks a user as removed without losing the record.
      // Users with deleted_at set are blocked from signing in and never re-created.
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`,
      // banned_emails: catches hard-deleted users (row already gone from users table).
      // Insert the email here before deleting the user row to permanently block them.
      `CREATE TABLE IF NOT EXISTS banned_emails (
        email TEXT PRIMARY KEY,
        banned_at TIMESTAMPTZ DEFAULT NOW(),
        reason TEXT
      )`,
    ],
  },
  {
    version: 15,
    name: 'user_xai_api_key',
    up: [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS xai_api_key TEXT`,
    ],
  },
  {
    version: 17,
    name: 'user_tts_api_keys',
    up: [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS cartesia_api_key TEXT`,
    ],
  },
  {
    version: 16,
    name: 'wizard_jobs',
    up: [
      `CREATE TABLE IF NOT EXISTS wizard_jobs (
        thread_id   TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'running',
        interrupt   JSONB,
        payload     JSONB,
        error       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS wizard_jobs_user_id_idx ON wizard_jobs(user_id)`,
    ],
  },
  {
    version: 14,
    name: 'support_tickets',
    up: [
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
        email       TEXT NOT NULL,
        name        TEXT,
        subject     TEXT NOT NULL,
        status      TEXT DEFAULT 'open',
        priority    TEXT DEFAULT 'normal',
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS support_messages (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
        sender_role TEXT NOT NULL,
        message     TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
    ],
  },
  {
    version: 18,
    name: 'create_plugins',
    up: [
      `CREATE TABLE IF NOT EXISTS plugins (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        version     TEXT DEFAULT '1.0.0',
        category    TEXT DEFAULT 'custom',
        icon        TEXT DEFAULT 'puzzle',
        color       TEXT DEFAULT '#7C3AED',
        status      TEXT DEFAULT 'stable',
        s3_key      TEXT NOT NULL,
        schema_json TEXT NOT NULL DEFAULT '{}',
        user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
    ],
  },
  {
    version: 19,
    name: 'hybrid_mcp_state',
    up: [
      `ALTER TABLE wizard_jobs ADD COLUMN IF NOT EXISTS state JSONB`,
      `ALTER TABLE plugins ADD COLUMN IF NOT EXISTS generation_fields JSONB DEFAULT '{"image":[],"audio":[],"video":[]}'::jsonb`,
    ],
  },
  {
    version: 20,
    name: 'plugin_tags_and_likes',
    up: [
      `ALTER TABLE plugins ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[]`,
      `ALTER TABLE plugins ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0`,
      `CREATE INDEX IF NOT EXISTS plugins_tags_gin_idx ON plugins USING GIN (tags)`,
    ],
  },
];

/**
 * Run all pending migrations. Safe to call multiple times.
 */
export async function runMigrations(): Promise<{ ran: string[]; skipped: string[] }> {
  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  // Get already-applied versions
  const result = await db.query('SELECT version FROM _migrations ORDER BY version');
  const applied = new Set(result.rows.map((r: any) => r.version));

  const ran: string[] = [];
  const skipped: string[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      skipped.push(`v${migration.version}: ${migration.name}`);
      continue;
    }

    console.log(`[migrate] Running v${migration.version}: ${migration.name}`);
    for (const sql of migration.up) {
      await db.query(sql);
    }

    await db.query(
      'INSERT INTO _migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );

    ran.push(`v${migration.version}: ${migration.name}`);
  }

  return { ran, skipped };
}

/**
 * Seed default data. Safe to call multiple times (uses ON CONFLICT).
 */
export async function runSeeders(): Promise<string[]> {
  const seeded: string[] = [];

  // Add default admin user if needed
  const adminResult = await db.query(
    `INSERT INTO users (id, email, name, role, "videoLimit", "aiLimit", "aiTokenLimit")
     VALUES ('admin', 'admin@videogen.app', 'Admin', 'ADMIN', 999, 999, 999999)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`
  );
  if (adminResult.rows.length > 0) seeded.push('admin user');

  return seeded;
}
